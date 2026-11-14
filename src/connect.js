// Works out how an AI app should start the Tassel MCP bridge on this computer,
// and (when asked) adds Tassel to Claude Desktop's list of local connectors.
const { app } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const control = require('./control');

function bridgePath() {
  // In an installed copy the bridge is unpacked next to the app archive so other programs can run it.
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'mcp', 'bridge.js')
    : path.join(app.getAppPath(), 'mcp', 'bridge.js');
}

// Tassel's own executable doubles as the Node runtime, so nobody has to install Node.
function launchSpec() {
  return {
    command: process.execPath,
    args: [bridgePath(), control.connectionFile()],
    env: { ELECTRON_RUN_AS_NODE: '1' },
  };
}

// Folders where Claude Desktop keeps claude_desktop_config.json on this computer.
function claudeDesktopDirs() {
  const dirs = [];
  const home = os.homedir();
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    try {
      // Microsoft Store / MSIX installs keep their settings inside the package folder.
      for (const name of fs.readdirSync(path.join(local, 'Packages'))) {
        if (/^(AnthropicPBC\.)?Claude_/i.test(name)) dirs.push(path.join(local, 'Packages', name, 'LocalCache', 'Roaming', 'Claude'));
      }
    } catch {}
    dirs.push(path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude'));
  } else if (process.platform === 'darwin') {
    dirs.push(path.join(home, 'Library', 'Application Support', 'Claude'));
  } else {
    dirs.push(path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'Claude'));
  }
  return dirs.filter((d) => fs.existsSync(d));
}

const quote = (s) => (/[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);

function info() {
  const spec = launchSpec();
  const dirs = claudeDesktopDirs();
  const installed = dirs.some((d) => {
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(d, 'claude_desktop_config.json'), 'utf8'));
      return !!(cfg.mcpServers && cfg.mcpServers.tassel);
    } catch {
      return false;
    }
  });
  return {
    claudeDesktopFound: dirs.length > 0,
    claudeDesktopInstalled: installed,
    json: JSON.stringify({ mcpServers: { tassel: spec } }, null, 2),
    claudeCode: `claude mcp add --scope user --env ELECTRON_RUN_AS_NODE=1 tassel -- ${[spec.command, ...spec.args].map(quote).join(' ')}`,
  };
}

// Add (or refresh) the "tassel" entry in Claude Desktop's config. Everything else in the file is kept,
// and the previous version is saved alongside as a backup.
function installClaudeDesktop() {
  const dirs = claudeDesktopDirs();
  if (!dirs.length) throw new Error('Claude Desktop was not found on this computer. Use "Copy settings" and add them in your AI app instead.');
  const spec = launchSpec();
  let written = 0;
  for (const dir of dirs) {
    const file = path.join(dir, 'claude_desktop_config.json');
    let cfg = {};
    if (fs.existsSync(file)) {
      const text = fs.readFileSync(file, 'utf8');
      try {
        cfg = text.trim() ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Claude Desktop's settings file could not be read, so Tassel left it alone: ${file}`);
      }
      if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) cfg = {};
      fs.copyFileSync(file, file + '.before-tassel');
    }
    if (!cfg.mcpServers || typeof cfg.mcpServers !== 'object') cfg.mcpServers = {};
    cfg.mcpServers.tassel = spec;
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2), 'utf8');
    written++;
  }
  return { written };
}

function removeClaudeDesktop() {
  let removed = 0;
  for (const dir of claudeDesktopDirs()) {
    const file = path.join(dir, 'claude_desktop_config.json');
    try {
      const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (cfg.mcpServers && cfg.mcpServers.tassel) {
        delete cfg.mcpServers.tassel;
        fs.writeFileSync(file, JSON.stringify(cfg, null, 2), 'utf8');
        removed++;
      }
    } catch {}
  }
  return { removed };
}

module.exports = { info, installClaudeDesktop, removeClaudeDesktop, launchSpec, bridgePath };
