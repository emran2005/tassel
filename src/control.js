// The local door that the MCP bridge (mcp/bridge.js) knocks on.
// - listens on 127.0.0.1 only, on a random port
// - every request must carry a random token that is written to a file only this user can read
// - requests from web pages are refused (they carry an Origin header and cannot know the token)
// Each call is handed to the Tassel window, which does the work and answers.
const { app, ipcMain } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

const connectionFile = () => path.join(app.getPath('userData'), 'mcp-connection.json');

let server = null;
let token = '';
let seq = 0;
const pending = new Map();
let getWindow = () => null;

function sameToken(header) {
  const want = Buffer.from('Bearer ' + token);
  const got = Buffer.from(String(header || ''));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

function dispatch(tool, args) {
  return new Promise((resolve, reject) => {
    const win = getWindow();
    if (!win || win.isDestroyed()) return reject(new Error('The Tassel window is closed. Open Tassel and try again.'));
    const id = ++seq;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Tassel took too long to answer.'));
    }, 110000);
    pending.set(id, { resolve, reject, timer, sender: win.webContents });
    win.webContents.send('mcp:call', { id, tool, args: args || {} });
  });
}

function onRequest(req, res) {
  const answer = (status, body) => {
    const text = JSON.stringify(body);
    res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) });
    res.end(text);
  };
  const host = String(req.headers.host || '');
  if (req.headers.origin || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) return answer(403, { ok: false, error: 'Forbidden.' });
  if (req.method !== 'POST' || req.url !== '/call') return answer(404, { ok: false, error: 'Not found.' });
  if (!sameToken(req.headers.authorization)) return answer(401, { ok: false, error: 'Not authorised.' });

  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > 4 * 1024 * 1024) req.destroy();
    else chunks.push(c);
  });
  req.on('end', async () => {
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return answer(400, { ok: false, error: 'Bad request.' });
    }
    if (!body || typeof body.tool !== 'string') return answer(400, { ok: false, error: 'Bad request.' });
    try {
      answer(200, { ok: true, data: await dispatch(body.tool, body.args) });
    } catch (err) {
      answer(200, { ok: false, error: (err && err.message) || String(err) });
    }
  });
}

function start(windowGetter) {
  getWindow = windowGetter;
  token = crypto.randomBytes(32).toString('hex');

  ipcMain.on('mcp:result', (event, msg) => {
    const p = msg && pending.get(msg.id);
    if (!p || p.sender !== event.sender) return;
    pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.ok) p.resolve(msg.data);
    else p.reject(new Error(msg.error || 'Tassel could not do that.'));
  });

  return new Promise((resolve) => {
    server = http.createServer(onRequest);
    server.on('error', (err) => {
      console.error('MCP door failed to open', err);
      resolve(false);
    });
    server.listen(0, '127.0.0.1', () => {
      const file = connectionFile();
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ port: server.address().port, token, pid: process.pid }), { mode: 0o600 });
      } catch (err) {
        console.error('could not write MCP connection file', err);
      }
      resolve(true);
    });
  });
}

function stop() {
  try {
    fs.unlinkSync(connectionFile());
  } catch {}
  if (server) server.close();
  server = null;
}

module.exports = { start, stop, connectionFile };
