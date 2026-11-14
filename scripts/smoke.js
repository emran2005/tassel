// Runs Tassel through every screen with a stand-in AI and a throwaway profile folder.
// Usage: npm run smoke   (screenshots + results.json land in ./smoke-out)
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const out = process.argv[2] || path.join(root, 'smoke-out');
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'tassel-smoke-'));
const electron = require('electron'); // path to the binary when required from Node

const res = spawnSync(electron, ['.'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, TASSEL_SMOKE: out, TASSEL_USER_DATA: userData },
});
fs.rmSync(userData, { recursive: true, force: true });
process.exit(res.status == null ? 1 : res.status);
