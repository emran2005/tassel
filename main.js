// Tassel - main process: window, built-in browser plumbing, and IPC.
const { app, BrowserWindow, ipcMain, dialog, shell, session, webContents, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Test runs (scripts/smoke.js) use a throwaway profile folder so they never touch real data.
if (process.env.TASSEL_USER_DATA) app.setPath('userData', process.env.TASSEL_USER_DATA);
// ...and keep painting even when another window covers Tassel, so test screenshots are never stale.
if (process.env.TASSEL_SMOKE) app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

const store = require('./src/store');
const ai = require('./src/ai');
const agent = require('./src/agent');
const control = require('./src/control');
const connect = require('./src/connect');
const logos = require('./src/logos');

const isMac = process.platform === 'darwin';
const PARTITION = 'persist:tassel';
const INK = '#141C18';
const BAR = '#ECE8DD';
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    backgroundColor: INK,
    title: 'Tassel',
    icon: path.join(__dirname, 'ui', 'brand', 'icon-256.png'),
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac ? { trafficLightPosition: { x: 16, y: 15 } } : { titleBarOverlay: { color: INK, symbolColor: '#F6F3EC', height: 44 } }),
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      spellcheck: true,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'ui', 'index.html'));

  // The Tassel window itself never navigates anywhere or opens windows.
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // Lock down every embedded browser tab before it is created.
  win.webContents.on('will-attach-webview', (_e, prefs, params) => {
    delete prefs.preload;
    prefs.nodeIntegration = false;
    prefs.contextIsolation = true;
    prefs.sandbox = true;
    params.partition = PARTITION;
  });
  win.on('closed', () => (win = null));

  if (process.env.TASSEL_DEVTOOLS) win.webContents.openDevTools({ mode: 'detach' });
}

function buildMenu() {
  if (!isMac) return Menu.setApplicationMenu(null);
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }])
  );
}

const tabOf = (id) => {
  const wc = webContents.fromId(Number(id));
  if (!wc || wc.isDestroyed() || wc.getType() !== 'webview') throw new Error('That tab is not ready yet.');
  return wc;
};

// Every IPC answer is { ok, data } or { ok:false, error } so the UI can always show a clear message.
const handle = (channel, fn) =>
  ipcMain.handle(channel, async (event, payload) => {
    try {
      return { ok: true, data: await fn(payload || {}, event) };
    } catch (err) {
      return { ok: false, error: ai.friendly(err) };
    }
  });

function registerIpc() {
  handle('app:info', () => ({
    platform: process.platform,
    version: app.getVersion(),
    practiceUrl: pathToFileURL(path.join(__dirname, 'ui', 'practice.html')).href,
    models: ai.MODELS,
    defaultModel: ai.DEFAULT_MODEL,
    smoke: !!process.env.TASSEL_SMOKE,
  }));
  handle('state:load', () => store.loadState());
  ipcMain.on('state:save', (_e, state) => {
    try {
      if (!state || typeof state !== 'object') return;
      const res = store.saveState(state);
      // Another device saved to the synced folder first: show its copy instead of overwriting it.
      if (res.conflict && !_e.sender.isDestroyed()) _e.sender.send('state:external', res.conflict);
    } catch (err) {
      console.error('save failed', err);
    }
  });
  handle('state:reset', async () => {
    store.wipe();
    await session.fromPartition(PARTITION).clearStorageData();
    return true;
  });
  handle('app:openData', () => shell.showItemInFolder(store.dataFile()));
  handle('app:openExternal', ({ url }) => {
    if (!/^https?:\/\//i.test(url || '')) throw new Error('Not a web link.');
    return shell.openExternal(url);
  });
  handle('app:pickFile', async ({ title, pdfOnly }) => {
    const res = await dialog.showOpenDialog(win, {
      title: title || 'Choose a file',
      properties: ['openFile'],
      filters: pdfOnly
        ? [{ name: 'PDF', extensions: ['pdf'] }]
        : [
            { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'] },
            { name: 'All files', extensions: ['*'] },
          ],
    });
    return res.canceled || !res.filePaths.length ? '' : res.filePaths[0];
  });
  handle('app:fileExists', ({ path: p }) => !!p && fs.existsSync(store.resolveDoc(p)));
  handle('logo', ({ domain }) => logos.logoFor(domain));

  // Keeping the data in a folder that syncs between devices
  handle('sync:status', () => store.syncStatus());
  handle('sync:choose', async () => {
    const res = await dialog.showOpenDialog(win, { title: 'Choose a folder that syncs between your devices', properties: ['openDirectory', 'createDirectory'] });
    return res.canceled || !res.filePaths.length ? null : store.inspectFolder(res.filePaths[0]);
  });
  handle('sync:enable', ({ dir, adopt, state }) => ({ state: store.enableSync(dir, !!adopt, state), sync: store.syncStatus() }));
  handle('sync:disable', ({ state }) => ({ state: store.disableSync(state), sync: store.syncStatus() }));
  handle('state:check', () => ({ sync: store.syncStatus(), state: store.checkExternal() }));
  handle('doc:import', ({ path: p, key }) => store.importDoc(p, key));
  ipcMain.on('app:chrome', (_e, mode) => {
    if (!win || isMac) return;
    try {
      win.setTitleBarOverlay(
        mode === 'dark' ? { color: INK, symbolColor: '#F6F3EC', height: 44 } : { color: BAR, symbolColor: '#17201C', height: 44 }
      );
    } catch {}
  });

  handle('key:status', () => ({ hasKey: store.hasKey() }));
  handle('key:set', async ({ key }) => {
    await store.setKey(key);
    return { hasKey: store.hasKey() };
  });
  handle('key:test', ({ model }) => ai.testKey({ model }));

  handle('ai:findPrograms', (p) => ai.findPrograms(p));
  handle('ai:draftEssays', (p) => ai.draftEssays(p));
  handle('ai:readResume', (p) => ai.readResume(p));

  handle('agent:fillPage', (p, event) => {
    const wc = tabOf(p.wcId);
    const say = (text) => {
      if (!event.sender.isDestroyed()) event.sender.send('agent:progress', { wcId: p.wcId, text });
    };
    return agent.fillPage(wc, p, say);
  });
  handle('agent:apply', (p) => agent.applyFills(tabOf(p.wcId), p.fills || []));
  handle('agent:click', (p) => agent.click(tabOf(p.wcId), p.ref));
  handle('agent:reveal', (p) => agent.reveal(tabOf(p.wcId), p.ref));
  handle('agent:upload', async (p) => {
    await agent.upload(tabOf(p.wcId), p.ref, store.resolveDoc(p.path));
    return true;
  });

  // Used when an outside AI app drives Tassel over MCP. The guards live in agent.js.
  handle('agent:describe', (p) => agent.describePage(tabOf(p.wcId)));
  handle('agent:safeFill', (p) => agent.safeFill(tabOf(p.wcId), p.fills));
  handle('agent:safeClick', (p) => agent.safeClick(tabOf(p.wcId), p.ref));
  handle('agent:safeUpload', (p) => agent.safeUpload(tabOf(p.wcId), p.ref, store.resolveDoc(p.path)));
  handle('mcp:info', () => connect.info());
  handle('mcp:installClaude', () => connect.installClaudeDesktop());
  handle('mcp:removeClaude', () => connect.removeClaudeDesktop());
}

function setupBrowserSession() {
  const ses = session.fromPartition(PARTITION);
  // Look like the ordinary Chrome that Tassel is built on, so university portals behave normally.
  ses.setUserAgent(ses.getUserAgent().replace(/\s(Electron|tassel|Tassel)\/\S+/g, ''));
  ses.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(['clipboard-sanitized-write', 'fullscreen'].includes(permission));
  });
}

app.on('web-contents-created', (_e, wc) => {
  if (wc.getType() !== 'webview') return;
  // Links that want a new window open in the same tab instead.
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) setImmediate(() => !wc.isDestroyed() && wc.loadURL(url).catch(() => {}));
    return { action: 'deny' };
  });
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(async () => {
    await store.initKey();
    buildMenu();
    setupBrowserSession();
    registerIpc();
    createWindow();
    await control.start(() => win); // the local door for AI apps connecting over MCP
    if (process.env.TASSEL_SMOKE) require('./scripts/smoke-driver')(win);
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on('window-all-closed', () => {
    if (!isMac) app.quit();
  });
  app.on('will-quit', () => control.stop());
}
