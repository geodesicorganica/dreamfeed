'use strict';
// Dreamfeed localhost server. Binds 127.0.0.1 only (Gate F ux-2: localhost-only,
// nothing reachable beyond the local machine). GET-only: any other method is
// rejected, so no write path exists at the transport layer either (NFR1).

const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildState } = require('./state');

const PORT = process.env.DREAMFEED_PORT ? parseInt(process.env.DREAMFEED_PORT, 10) : 4173;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const STATIC = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/index.html': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/styles.css': { file: 'styles.css', type: 'text/css; charset=utf-8' },
  '/app.js': { file: 'app.js', type: 'text/javascript; charset=utf-8' },
};

const server = http.createServer((req, res) => {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Dreamfeed is read-only: GET only.');
    return;
  }
  const url = req.url.split('?')[0];
  if (url === '/api/state') {
    // Pull architecture: every request re-reads the governance files.
    let state;
    try {
      state = buildState();
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ fatal: String(err.message || err) }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(state));
    return;
  }
  const entry = STATIC[url];
  if (!entry) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found.');
    return;
  }
  fs.readFile(path.join(PUBLIC_DIR, entry.file), (err, data) => {
    if (err) { res.writeHead(500); res.end('Static read error.'); return; }
    res.writeHead(200, { 'Content-Type': entry.type, 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Dreamfeed (Stakeport OS Command Center — Operational Core) on http://127.0.0.1:${PORT}/ — localhost-only, read-only.`);
  });
}

module.exports = { server, PORT };
