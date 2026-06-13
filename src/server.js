'use strict';
// Dreamfeed localhost server. Binds 127.0.0.1 only (Gate F ux-2: localhost-only,
// nothing reachable beyond the local machine). GET-only: any other method is
// rejected, so no write path exists at the transport layer either (NFR1).

const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildState } = require('./state');
const { getRepoHealth } = require('./repohealth');
const { REPO_ROOT } = require('./parse');

// Read-only file viewer (item B6 — approval deep-review). Strict allowlist:
// repo-relative path, no traversal outside REPO_ROOT, allowed text extensions
// only, never under .git/ or node_modules/, size-capped. GET only. The cockpit
// never writes — this only reads file text for the embedded viewer.
const VIEW_EXT = new Set(['.md', '.json', '.js', '.html', '.css', '.txt']);
const VIEW_MAX_BYTES = 512 * 1024;

function readRepoFile(relPath) {
  if (!relPath || typeof relPath !== 'string') return { error: 'missing path' };
  const norm = relPath.replace(/\\/g, '/');
  if (norm.includes('..')) return { error: 'path traversal rejected' };
  const abs = path.resolve(REPO_ROOT, norm);
  const rootPrefix = REPO_ROOT.endsWith(path.sep) ? REPO_ROOT : REPO_ROOT + path.sep;
  if (abs !== REPO_ROOT && !abs.startsWith(rootPrefix)) return { error: 'outside repository' };
  const relCheck = path.relative(REPO_ROOT, abs).replace(/\\/g, '/');
  if (/(^|\/)(\.git|node_modules)(\/|$)/.test(relCheck)) return { error: 'path not viewable' };
  if (!VIEW_EXT.has(path.extname(abs).toLowerCase())) return { error: 'extension not viewable' };
  let stat;
  try { stat = fs.statSync(abs); } catch { return { error: 'not found' }; }
  if (!stat.isFile()) return { error: 'not a file' };
  if (stat.size > VIEW_MAX_BYTES) return { error: `file too large (${stat.size} bytes; cap ${VIEW_MAX_BYTES})` };
  try {
    return { path: relCheck, size: stat.size, modified: stat.mtime.toISOString(), content: fs.readFileSync(abs, 'utf8') };
  } catch (err) { return { error: String(err.message || err) }; }
}

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
  if (url === '/api/repo-health') {
    // Goal C — read-only git inspection. Never mutates the repo.
    let health;
    try { health = getRepoHealth(); }
    catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ fatal: String(err.message || err) }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(health));
    return;
  }
  if (url === '/api/file') {
    const q = req.url.split('?')[1] || '';
    const params = new URLSearchParams(q);
    const out = readRepoFile(params.get('path'));
    res.writeHead(out.error ? 400 : 200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(out));
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

module.exports = { server, PORT, readRepoFile };
