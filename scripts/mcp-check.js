// Talks to the Tassel MCP bridge the way an AI app would, and prints what comes back.
// Tassel must be open. Usage:
//   node scripts/mcp-check.js                       (uses node + mcp/bridge.js)
//   node scripts/mcp-check.js <command> <args...>   (e.g. the packaged Tassel.exe and its bridge)
const { spawn } = require('child_process');
const path = require('path');

const [command, ...args] = process.argv.length > 2 ? process.argv.slice(2) : [process.execPath, path.join(__dirname, '..', 'mcp', 'bridge.js')];
const child = spawn(command, args, { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['pipe', 'pipe', 'inherit'] });

let buf = '';
let nextId = 1;
const waiters = new Map();
child.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    const m = JSON.parse(line);
    const w = waiters.get(m.id);
    if (w) {
      waiters.delete(m.id);
      w(m);
    }
  }
});
const rpc = (method, params) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    waiters.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    setTimeout(() => waiters.has(id) && reject(new Error('no answer to ' + method)), 20000);
  });

(async () => {
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'mcp-check', version: '1' } });
  console.log('server:', init.result.serverInfo.name, init.result.serverInfo.version, 'protocol', init.result.protocolVersion);
  const tools = await rpc('tools/list', {});
  console.log('tools:', tools.result.tools.map((t) => t.name).join(', '));
  const overview = await rpc('tools/call', { name: 'tassel_overview', arguments: {} });
  console.log(overview.result.isError ? 'overview ERROR:' : 'overview:', overview.result.content[0].text.slice(0, 400));
  child.kill();
  process.exit(overview.result.isError ? 1 : 0);
})().catch((err) => {
  console.error('FAILED:', err.message);
  child.kill();
  process.exit(1);
});
