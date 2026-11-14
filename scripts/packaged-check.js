// Opens the packaged Tassel (the one inside dist/), waits for it to come up, and talks to it
// through the bundled MCP bridge the way an AI app would. Proves the built app really starts.
// Usage: node scripts/packaged-check.js     (after npm run dist:win or dist:mac)
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

function findApp() {
  if (process.platform === 'darwin') {
    const dir = fs.readdirSync(dist).find((d) => d.startsWith('mac') && fs.existsSync(path.join(dist, d, 'Tassel.app')));
    if (!dir) return null;
    const appDir = path.join(dist, dir, 'Tassel.app', 'Contents');
    return { exe: path.join(appDir, 'MacOS', 'Tassel'), resources: path.join(appDir, 'Resources') };
  }
  const unpacked = path.join(dist, 'win-unpacked');
  return { exe: path.join(unpacked, 'Tassel.exe'), resources: path.join(unpacked, 'resources') };
}

const found = findApp();
if (!found || !fs.existsSync(found.exe)) {
  console.error('No packaged Tassel found in dist/. Build it first.');
  process.exit(1);
}
const bridge = path.join(found.resources, 'app.asar.unpacked', 'mcp', 'bridge.js');
if (!fs.existsSync(bridge)) {
  console.error('The MCP bridge is missing from the package:', bridge);
  process.exit(1);
}

// A throwaway data folder, so this never touches a real profile.
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'tassel-packaged-'));
const connection = path.join(userData, 'mcp-connection.json');
const env = { ...process.env, TASSEL_USER_DATA: userData };
delete env.ELECTRON_RUN_AS_NODE;

console.log('starting', found.exe);
const app = spawn(found.exe, [], { env, stdio: 'inherit' });
let exited = null;
app.on('exit', (code, signal) => { exited = { code, signal }; });

const finish = (code) => {
  try { app.kill(); } catch {}
  setTimeout(() => {
    try { fs.rmSync(userData, { recursive: true, force: true }); } catch {}
    process.exit(code);
  }, 1500);
};

const started = Date.now();
const timer = setInterval(() => {
  if (exited) {
    clearInterval(timer);
    console.error('Tassel closed before it was ready:', JSON.stringify(exited));
    return finish(1);
  }
  if (fs.existsSync(connection)) {
    clearInterval(timer);
    console.log('Tassel is up after', Math.round((Date.now() - started) / 1000), 's');
    // Give the window a moment to finish loading before asking it anything.
    setTimeout(() => {
      const res = spawnSync(process.execPath, [path.join(__dirname, 'mcp-check.js'), found.exe, bridge, connection], { stdio: 'inherit' });
      console.log(res.status === 0 ? 'PACKAGED APP OK' : 'PACKAGED APP FAILED');
      finish(res.status === 0 ? 0 : 1);
    }, 4000);
    return;
  }
  if (Date.now() - started > 90000) {
    clearInterval(timer);
    console.error('Tassel did not come up within 90 seconds.');
    finish(1);
  }
}, 500);
