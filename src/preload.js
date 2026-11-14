// The only bridge between the Tassel window and the main process.
const { contextBridge, ipcRenderer } = require('electron');

const call = (channel) => (payload) => ipcRenderer.invoke(channel, payload);

contextBridge.exposeInMainWorld('tassel', {
  info: call('app:info'),
  loadState: call('state:load'),
  saveState: (state) => ipcRenderer.send('state:save', state),
  resetAll: call('state:reset'),
  openDataFolder: call('app:openData'),
  openExternal: call('app:openExternal'),
  pickFile: call('app:pickFile'),
  fileExists: call('app:fileExists'),
  setChrome: (mode) => ipcRenderer.send('app:chrome', mode),
  logo: call('logo'),
  importDoc: call('doc:import'),

  // Multi-device sync through a shared folder
  syncStatus: call('sync:status'),
  syncChoose: call('sync:choose'),
  syncEnable: call('sync:enable'),
  syncDisable: call('sync:disable'),
  stateCheck: call('state:check'),
  onExternalState: (fn) => ipcRenderer.on('state:external', (_e, state) => fn(state)),

  keyStatus: call('key:status'),
  setKey: call('key:set'),
  testKey: call('key:test'),

  findPrograms: call('ai:findPrograms'),
  draftEssays: call('ai:draftEssays'),
  readResume: call('ai:readResume'),

  fillPage: call('agent:fillPage'),
  applyFills: call('agent:apply'),
  clickRef: call('agent:click'),
  revealRef: call('agent:reveal'),
  uploadFile: call('agent:upload'),

  onProgress: (fn) => ipcRenderer.on('agent:progress', (_e, data) => fn(data)),

  // An outside AI app working through MCP
  describePage: call('agent:describe'),
  safeFill: call('agent:safeFill'),
  safeClick: call('agent:safeClick'),
  safeUpload: call('agent:safeUpload'),
  mcpInfo: call('mcp:info'),
  mcpInstallClaude: call('mcp:installClaude'),
  mcpRemoveClaude: call('mcp:removeClaude'),
  onMcpCall: (fn) => ipcRenderer.on('mcp:call', (_e, msg) => fn(msg)),
  mcpResult: (msg) => ipcRenderer.send('mcp:result', msg),
});
