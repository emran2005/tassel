// Local persistence. Everything stays on this computer unless the applicant chooses a synced folder:
//   tassel-data.json    - profile, applications, essays, settings (also kept in the synced folder when syncing)
//   tassel-config.json  - per-device settings: where the synced folder is
//   tassel-key.bin      - the AI key, encrypted with the OS keychain when available (never synced)
const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

const DATA = 'tassel-data.json';
const localFile = () => path.join(app.getPath('userData'), DATA);
const configFile = () => path.join(app.getPath('userData'), 'tassel-config.json');
const keyFile = () => path.join(app.getPath('userData'), 'tassel-key.bin');

/* ---- per-device config ---- */
let config = null;
function loadConfig() {
  if (config) return config;
  try {
    config = JSON.parse(fs.readFileSync(configFile(), 'utf8')) || {};
  } catch {
    config = {};
  }
  return config;
}
function saveConfig() {
  fs.mkdirSync(path.dirname(configFile()), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify(config, null, 2), 'utf8');
}

/* ---- the synced folder ---- */
const syncDir = () => loadConfig().syncDir || '';
const syncAvailable = () => {
  const dir = syncDir();
  try {
    return !!dir && fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
};
const syncFile = () => path.join(syncDir(), DATA);
const syncStatus = () => ({ enabled: !!syncDir(), dir: syncDir(), available: !syncDir() || syncAvailable() });
// What we last read from or wrote to the synced file, to notice when another device changes it.
let seen = { mtimeMs: 0, savedAt: 0 };

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}
function writeJson(file, value) {
  const tmp = file + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}
const mtimeOf = (file) => {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
};
const rememberSync = (state) => {
  seen = { mtimeMs: mtimeOf(syncFile()), savedAt: (state && state.savedAt) || 0 };
};

function loadState() {
  const file = localFile();
  let local = null;
  if (fs.existsSync(file)) {
    local = readJson(file);
    if (!local) {
      // Never silently throw away someone's profile: keep the unreadable file.
      try {
        fs.copyFileSync(file, file + '.unreadable-' + Date.now());
      } catch {}
    }
  }
  if (!syncAvailable()) return local;
  const shared = readJson(syncFile());
  rememberSync(shared);
  if (!shared) return local;
  // Normally the synced copy wins. This device's copy wins only if it was saved later
  // (it kept working while the folder was unreachable).
  return local && (local.savedAt || 0) > (shared.savedAt || 0) ? local : shared;
}

/**
 * Saves. Returns { conflict: state } instead of saving when another device has written
 * to the synced folder since we last looked - the caller should show that newer copy.
 */
function saveState(state) {
  state.savedAt = Date.now();
  if (syncAvailable()) {
    const now = mtimeOf(syncFile());
    if (seen.mtimeMs && now && now !== seen.mtimeMs) {
      const theirs = readJson(syncFile());
      if (theirs && (theirs.savedAt || 0) !== seen.savedAt) {
        rememberSync(theirs);
        writeJson(localFile(), theirs);
        return { conflict: theirs };
      }
    }
    writeJson(syncFile(), state);
    rememberSync(state);
  }
  writeJson(localFile(), state); // always keep a copy on this device too
  return {};
}

/** Has the other device saved since we last looked? Returns its state, or null. */
function checkExternal() {
  if (!syncAvailable()) return null;
  const now = mtimeOf(syncFile());
  if (!now || now === seen.mtimeMs) return null;
  const theirs = readJson(syncFile());
  if (!theirs) return null;
  const changed = (theirs.savedAt || 0) !== seen.savedAt;
  rememberSync(theirs);
  if (!changed) return null;
  writeJson(localFile(), theirs);
  return theirs;
}

/* ---- documents: with syncing on they live in the synced folder, stored as "sync:documents/<file>" ---- */
const SYNC_PREFIX = 'sync:';
const resolveDoc = (p) => (typeof p === 'string' && p.startsWith(SYNC_PREFIX) ? path.join(syncDir(), p.slice(SYNC_PREFIX.length)) : p || '');

function importDoc(absPath, key) {
  if (!absPath || absPath.startsWith(SYNC_PREFIX) || !syncAvailable()) return absPath;
  const safeKey = String(key || 'file').replace(/[^a-z0-9]/gi, '');
  const name = `${safeKey}-${path.basename(absPath)}`;
  const dest = path.join(syncDir(), 'documents', name);
  if (path.resolve(absPath) !== path.resolve(dest)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(absPath, dest);
  }
  return `${SYNC_PREFIX}documents/${name}`;
}

function describe(state) {
  if (!state) return '';
  const who = [state.profile && state.profile.personal && state.profile.personal.firstName, state.profile && state.profile.personal && state.profile.personal.lastName].filter(Boolean).join(' ');
  const n = Array.isArray(state.programs) ? state.programs.length : 0;
  const when = state.savedAt ? new Date(state.savedAt).toLocaleString() : 'an unknown time';
  return `It holds ${who ? who + "'s profile and " : ''}${n} application${n === 1 ? '' : 's'}, last saved ${when}.`;
}

/** What is in a folder the applicant is thinking of syncing to. */
function inspectFolder(dir) {
  const theirs = readJson(path.join(dir, DATA));
  return { dir, hasData: !!theirs, summary: describe(theirs) };
}

/** Start syncing to `dir`. adopt=true: use the data already there. Otherwise put `state` there. */
function enableSync(dir, adopt, state) {
  if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error('That folder could not be opened.');
  const probe = path.join(dir, '.tassel-write-test');
  try {
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
  } catch {
    throw new Error('Tassel cannot write to that folder. Pick another one.');
  }
  loadConfig().syncDir = dir;
  saveConfig();
  seen = { mtimeMs: 0, savedAt: 0 };
  let result;
  if (adopt) {
    result = readJson(syncFile());
    if (!result) throw new Error('The data in that folder could not be read.');
    rememberSync(result);
    writeJson(localFile(), result);
  } else {
    result = state;
    // Move this device's documents into the folder so the other device has them too.
    const docs = (result.profile && result.profile.documents) || {};
    for (const [key, p] of Object.entries(docs)) {
      if (p && !p.startsWith(SYNC_PREFIX) && fs.existsSync(p)) {
        try {
          docs[key] = importDoc(p, key);
        } catch {}
      }
    }
    saveState(result);
  }
  return result;
}

/** Stop syncing. Documents keep working: their paths become ordinary paths into the folder. */
function disableSync(state) {
  const docs = (state.profile && state.profile.documents) || {};
  for (const [key, p] of Object.entries(docs)) if (p && p.startsWith(SYNC_PREFIX)) docs[key] = resolveDoc(p);
  loadConfig().syncDir = '';
  saveConfig();
  seen = { mtimeMs: 0, savedAt: 0 };
  saveState(state);
  return state;
}

/* ---- AI key: held in memory while the app runs, encrypted on disk ---- */
let key = '';

async function writeKey(value) {
  const file = keyFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let canEncrypt = false;
  try {
    canEncrypt = await safeStorage.isAsyncEncryptionAvailable();
  } catch {}
  if (canEncrypt) {
    fs.writeFileSync(file, Buffer.concat([Buffer.from('enc:'), await safeStorage.encryptStringAsync(value)]));
  } else {
    fs.writeFileSync(file, Buffer.from('raw:' + value, 'utf8'));
  }
}

/** Call once after the app is ready. */
async function initKey() {
  key = '';
  try {
    const buf = fs.readFileSync(keyFile());
    const tag = buf.subarray(0, 4).toString();
    if (tag === 'enc:') {
      const out = await safeStorage.decryptStringAsync(buf.subarray(4));
      key = out.result || '';
      if (key && out.shouldReEncrypt) await writeKey(key);
    } else if (tag === 'raw:') {
      key = buf.subarray(4).toString('utf8');
    }
  } catch {}
}

async function setKey(value) {
  key = (value || '').trim();
  if (!key) {
    try {
      fs.unlinkSync(keyFile());
    } catch {}
    return;
  }
  await writeKey(key);
}

const getKey = () => key;
const hasKey = () => !!key;

// Erase this device's copy of everything. A synced folder is left alone (the other device may still need it).
function wipe() {
  key = '';
  config = {};
  seen = { mtimeMs: 0, savedAt: 0 };
  for (const f of [localFile(), keyFile(), configFile()]) {
    try {
      fs.unlinkSync(f);
    } catch {}
  }
}

const dataFile = () => (syncAvailable() ? syncFile() : localFile());

module.exports = {
  loadState, saveState, checkExternal, initKey, setKey, getKey, hasKey, wipe, dataFile,
  syncStatus, inspectFolder, enableSync, disableSync, resolveDoc, importDoc,
};
