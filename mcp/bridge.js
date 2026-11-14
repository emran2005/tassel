#!/usr/bin/env node
// Tassel MCP bridge.
// An AI app (Claude Desktop, Claude Code, Cursor, ...) starts this small program and talks to it over
// stdin/stdout using the Model Context Protocol. The bridge passes each tool call to the running
// Tassel app over a local-only connection. It has no dependencies, so it runs under plain Node or
// under Tassel's own executable (with ELECTRON_RUN_AS_NODE=1).
//
//   node bridge.js [path-to-mcp-connection.json]
'use strict';
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { TOOLS, INSTRUCTIONS } = require('./tools');

const VERSION = '0.1.0';
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

function defaultConnectionFile() {
  const home = os.homedir();
  const base =
    process.platform === 'win32'
      ? process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
      : process.platform === 'darwin'
        ? path.join(home, 'Library', 'Application Support')
        : process.env.XDG_CONFIG_HOME || path.join(home, '.config');
  return path.join(base, 'Tassel', 'mcp-connection.json');
}
const connectionFile = process.argv[2] || defaultConnectionFile();

const NOT_OPEN = 'Tassel is not open. Ask the applicant to open the Tassel app, then try again.';

// Ask the running Tassel app to do one thing. The connection file is re-read every time,
// because Tassel picks a new port and token each time it starts.
function callTassel(tool, args) {
  return new Promise((resolve, reject) => {
    let conn;
    try {
      conn = JSON.parse(fs.readFileSync(connectionFile, 'utf8'));
    } catch {
      return reject(new Error(NOT_OPEN));
    }
    const body = Buffer.from(JSON.stringify({ tool, args: args || {} }));
    const req = http.request(
      {
        host: '127.0.0.1',
        port: conn.port,
        path: '/call',
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': body.length, authorization: 'Bearer ' + conn.token },
        timeout: 120000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          let out;
          try {
            out = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch {
            return reject(new Error('Tassel gave an unreadable answer.'));
          }
          if (out && out.ok) resolve(out.data);
          else reject(new Error((out && out.error) || 'Tassel could not do that.'));
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('Tassel took too long to answer.')));
    req.on('error', (err) => reject(new Error(err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' ? NOT_OPEN : err.message)));
    req.end(body);
  });
}

const send = (message) => process.stdout.write(JSON.stringify(message) + '\n');
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

async function handle(msg) {
  const { id, method, params } = msg;
  const wantsReply = id !== undefined && id !== null;
  if (!method) return; // a response to something we never asked: ignore
  if (!wantsReply) return; // notifications (initialized, cancelled, ...) need no answer

  switch (method) {
    case 'initialize': {
      const asked = params && params.protocolVersion;
      return reply(id, {
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'tassel', title: 'Tassel', version: VERSION },
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return reply(id, {});
    case 'tools/list':
      return reply(id, { tools: TOOLS });
    case 'tools/call': {
      const name = params && params.name;
      if (!TOOLS.some((t) => t.name === name)) return fail(id, -32602, `Unknown tool: ${name}`);
      try {
        const data = await callTassel(name, params.arguments);
        return reply(id, { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 1) }] });
      } catch (err) {
        // Tool problems go back as a normal result the model can read and react to.
        return reply(id, { content: [{ type: 'text', text: err.message }], isError: true });
      }
    }
    default:
      return fail(id, -32601, `Method not found: ${method}`);
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  line = line.trim();
  if (!line) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return fail(null, -32700, 'Parse error');
  }
  for (const m of Array.isArray(msg) ? msg : [msg]) {
    handle(m).catch((err) => {
      if (m && m.id != null) fail(m.id, -32603, String((err && err.message) || err));
    });
  }
});
rl.on('close', () => process.exit(0));
process.stdin.on('error', () => process.exit(0));
