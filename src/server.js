'use strict';
// Dreamfeed localhost server. Binds 127.0.0.1 only (Gate F ux-2: localhost-only,
// nothing reachable beyond the local machine). GET-only: any other method is
// rejected, so no write path exists at the transport layer either (NFR1).

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildState } = require('./state');
const { buildQueue, buildSprintMetrics } = require('./queue');
const { buildNativeState } = require('./nativeSchema');
const { getRepoHealth } = require('./repohealth');
const { REPO_ROOT, canonicalRoot, canonicalKey, rootToken } = require('./parse');
const projectPicker = require('./projectPicker');

// In-memory action token (D28 local action guard). Generated once per process,
// never persisted to project-config.json / localStorage / cookies / governance
// files / query params. Delivered only in the no-arg /api/project descriptor to
// a request that passes the local request guard, and required as the
// X-Dreamfeed-Token header on state-changing/sensitive actions. This is
// transport-level CSRF/rebinding defense only — NOT an authorization model.
const ACTION_TOKEN = crypto.randomBytes(32).toString('hex');
const RECENT_CAP = 8;

// Read-only file viewer (item B6 — approval deep-review). Strict allowlist:
// repo-relative path, no traversal outside the active project root, allowed text
// extensions only, never under .git/ or node_modules/, size-capped, and
// realpath-contained so a symlink inside the root cannot escape it. GET only.
// The cockpit never writes — this only reads file text for the embedded viewer.
const VIEW_EXT = new Set(['.md', '.json', '.js', '.html', '.css', '.txt']);
const VIEW_MAX_BYTES = 512 * 1024;
const NO_GIT_NODE = /(^|\/)(\.git|node_modules)(\/|$)/;

// ---------------------------------------------------------------------------
// Project switching (governed scope addition). The server holds ONE active
// project root, defaulting to the Stakeport repo this cockpit ships in. It can
// be repointed at another LOCAL folder, persisted across restart in a
// cockpit-local sidecar (never a governance/source file). One active project per
// server: all tabs share it. See dreamfeed-reconciliation.md.
// ---------------------------------------------------------------------------
const PROJECT_CONFIG_FILE = path.join(__dirname, '..', 'project-config.json');

function validateRoot(p) {
  if (!p || typeof p !== 'string') return { ok: false, error: 'missing path' };
  if (!path.isAbsolute(p)) return { ok: false, error: 'project path must be absolute' };
  let stat;
  try { stat = fs.statSync(p); } catch { return { ok: false, error: 'path does not exist' }; }
  if (!stat.isDirectory()) return { ok: false, error: 'path is not a directory' };
  return { ok: true, root: canonicalRoot(p) };
}

function looksLikeRepo(root) {
  try { return fs.existsSync(path.join(root, 'agents')) || fs.existsSync(path.join(root, 'CLAUDE.md')); }
  catch { return false; }
}

// Read-only directory listing for the in-app folder browser (the cross-platform
// "explorer" picker). Lists ONLY subdirectories (never file contents), the parent
// for up-navigation, and on Windows the available drive roots. Sensitive (it
// discloses local folder structure), so it is behind the action guard at the
// route. Never writes anything.
function windowsDrives() {
  if (process.platform !== 'win32') return [];
  const drives = [];
  for (let c = 65; c <= 90; c++) {
    const d = `${String.fromCharCode(c)}:\\`;
    try { if (fs.existsSync(d)) drives.push(d); } catch { /* skip */ }
  }
  return drives;
}
function listDirs(reqPath) {
  let target = reqPath && reqPath.trim() ? reqPath : currentRoot;
  if (!target) {
    return { path: '', parent: null, atRoot: true, entries: [], drives: windowsDrives(), looksLikeRepo: false };
  }
  try { target = path.resolve(target); } catch { return { error: 'invalid path' }; }
  let stat;
  try { stat = fs.statSync(target); } catch { return { error: 'path not found', path: target }; }
  if (!stat.isDirectory()) target = path.dirname(target);
  let entries = [];
  try {
    entries = fs.readdirSync(target, { withFileTypes: true })
      .filter((d) => { try { return d.isDirectory(); } catch { return false; } })
      .map((d) => ({ name: d.name, path: path.join(target, d.name) }))
      .filter((e) => !e.name.startsWith('$')) // hide $Recycle.bin etc.
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  } catch { entries = []; } // unreadable dir → empty list, not an error
  const parent = path.dirname(target);
  const atRoot = parent === target;
  return {
    path: target,
    parent: atRoot ? null : parent,
    atRoot,
    entries,
    drives: windowsDrives(),
    looksLikeRepo: looksLikeRepo(target),
  };
}

// Canonical identity of the app root, computed once.
const REPO_ROOT_KEY = canonicalKey(REPO_ROOT);
function isDefaultRoot(root) {
  if (!root) return false;
  return canonicalKey(root) === REPO_ROOT_KEY;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

let currentRoot = null; // null = no project configured
let restoreWarning = null;
let recentRoots = []; // machine-local convenience only — NOT a governance object/registry.

function persistConfig() {
  // Cockpit-local sidecar: active root + recent list. Never a governance/source
  // file; gitignored. The action token is NEVER written here.
  try { fs.writeFileSync(PROJECT_CONFIG_FILE, JSON.stringify({ root: currentRoot, recent: recentRoots }, null, 2) + '\n', 'utf8'); return null; }
  catch (err) { return String(err.message || err); }
}

function rememberRecent(root) {
  if (!root) return;
  if (isDefaultRoot(root)) return;
  recentRoots = [root, ...recentRoots.filter((r) => canonicalKey(r) !== canonicalKey(root))].slice(0, RECENT_CAP);
}

(function restorePersistedRoot() {
  let raw;
  try { raw = fs.readFileSync(PROJECT_CONFIG_FILE, 'utf8'); } catch { return; }
  let rec;
  try { rec = JSON.parse(raw); } catch { restoreWarning = 'project-config.json unreadable; no project configured'; return; }
  if (!rec) return;
  // Restore the recent list (validated, existing dirs only), preserving order.
  if (Array.isArray(rec.recent)) {
    const seen = new Set();
    for (const r of rec.recent) {
      const v = validateRoot(r);
      if (!v.ok) continue;
      const k = canonicalKey(v.root);
      if (k === REPO_ROOT_KEY || seen.has(k)) continue;
      seen.add(k); recentRoots.push(v.root);
      if (recentRoots.length >= RECENT_CAP) break;
    }
  }
  if (!rec.root || isDefaultRoot(rec.root)) return;
  const v = validateRoot(rec.root);
  if (v.ok) currentRoot = v.root;
  else restoreWarning = `saved project is unavailable; no project configured`;
})();

// ---------------------------------------------------------------------------
// Local request guard (D28). Transport-level CSRF + DNS-rebinding defense only —
// never authorization. `localRequestGuard` gates the no-arg descriptor (token
// emission); `guardMutation` adds the X-Dreamfeed-Token header check for
// state-changing/sensitive actions. A future capability/permission model layers
// on top without touching this.
// ---------------------------------------------------------------------------
function isLoopbackHostName(h) {
  return h === '127.0.0.1' || h === 'localhost' || h === '[::1]' || h === '::1';
}
function listenPort(req) {
  return String(req.socket && req.socket.localPort ? req.socket.localPort : '');
}

function allowedHost(req) {
  // Host must name loopback on the ACTUAL listening port (never hardcode 4173),
  // so random test ports and DREAMFEED_PORT work; defeats DNS rebinding.
  const hostHeader = req.headers.host;
  if (!hostHeader) return false;
  // Split host:port, handling IPv6 [::1]:port. A malformed header → reject.
  const m = hostHeader.match(/^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/);
  if (!m) return false;
  const host = m[1], hp = m[2] || '';
  if (!isLoopbackHostName(host)) return false;
  // If a port is claimed it MUST match the listening port. If we cannot determine
  // our port, refuse rather than silently accept any claimed port. A bare host
  // (no port) is accepted (default-port case).
  if (hp && hp !== listenPort(req)) return false;
  return true;
}

function originRefererOk(req) {
  // Optional: validate ONLY when present; absence is never a rejection.
  for (const h of ['origin', 'referer']) {
    const val = req.headers[h];
    if (!val) continue;
    let u;
    try { u = new URL(val); } catch { return false; }
    if (!isLoopbackHostName(u.hostname)) return false;
    const port = listenPort(req);
    if (u.port && port && u.port !== port) return false;
  }
  return true;
}

function localRequestGuard(req) {
  if (!allowedHost(req)) return { ok: false, status: 403, error: 'host not allowed' };
  // Sec-Fetch-Site, when present, must not be cross-site/same-site. Absent is OK
  // (non-browser clients); the token remains the primary gate for mutations.
  const sfs = req.headers['sec-fetch-site'];
  if (sfs && sfs !== 'same-origin' && sfs !== 'none') return { ok: false, status: 403, error: 'cross-site request rejected' };
  if (!originRefererOk(req)) return { ok: false, status: 403, error: 'origin/referer not allowed' };
  return { ok: true };
}

function guardMutation(req) {
  const base = localRequestGuard(req);
  if (!base.ok) return base;
  const token = req.headers['x-dreamfeed-token'];
  if (!token || token !== ACTION_TOKEN) return { ok: false, status: 403, error: 'missing or invalid action token' };
  return { ok: true };
}

function projectDescriptor(req, extra = {}) {
  const guarded = req ? localRequestGuard(req) : { ok: true };
  const configured = currentRoot !== null;
  return {
    currentRoot,
    configured,
    rootToken: configured ? rootToken(currentRoot) : null,
    default: null,      // standalone: no built-in default project
    isDefault: false,   // retired concept; always false; kept for compat
    valid: true,
    looksLikeRepo: configured ? looksLikeRepo(currentRoot) : false,
    label: configured ? (path.basename(currentRoot) || currentRoot) : null,
    restoreWarning,
    recent: recentRoots.map((r) => ({ path: r, label: path.basename(r) || r })),
    pickers: { native: projectPicker.nativeAvailable(), providers: projectPicker.listProviders() },
    ...(req && guarded.ok ? { actionToken: ACTION_TOKEN } : {}),
    ...extra,
  };
}

function readRepoFile(relPath, repoRoot = currentRoot) {
  if (!repoRoot) return { error: 'no project configured' };
  if (!relPath || typeof relPath !== 'string') return { error: 'missing path' };
  const norm = relPath.replace(/\\/g, '/');
  if (norm.includes('..')) return { error: 'path traversal rejected' };
  const realRoot = canonicalRoot(repoRoot);
  const abs = path.resolve(realRoot, norm);
  const rootPrefix = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
  if (abs !== realRoot && !abs.startsWith(rootPrefix)) return { error: 'outside repository' };
  const relCheck = path.relative(realRoot, abs).replace(/\\/g, '/');
  if (NO_GIT_NODE.test(relCheck)) return { error: 'path not viewable' };
  if (!VIEW_EXT.has(path.extname(abs).toLowerCase())) return { error: 'extension not viewable' };
  let stat;
  try { stat = fs.statSync(abs); } catch { return { error: 'not found' }; }
  if (!stat.isFile()) return { error: 'not a file' };
  if (stat.size > VIEW_MAX_BYTES) return { error: `file too large (${stat.size} bytes; cap ${VIEW_MAX_BYTES})` };
  // Realpath containment: a symlink/junction inside the root must not point out
  // of it (string-prefix alone cannot catch this once arbitrary roots are allowed).
  let realTarget;
  try { realTarget = fs.realpathSync(abs); } catch { return { error: 'not found' }; }
  const realTargetOk = realTarget === realRoot || realTarget.startsWith(rootPrefix);
  if (!realTargetOk) return { error: 'symlink escapes repository' };
  if (NO_GIT_NODE.test(path.relative(realRoot, realTarget).replace(/\\/g, '/'))) return { error: 'path not viewable' };
  try {
    return { path: relCheck, size: stat.size, modified: stat.mtime.toISOString(), content: fs.readFileSync(realTarget, 'utf8') };
  } catch (err) { return { error: String(err.message || err) }; }
}

const PORT = process.env.DREAMFEED_PORT ? parseInt(process.env.DREAMFEED_PORT, 10) : 4173;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const DREAMFEED_SYSTEM_DIR = path.join(__dirname, '..', 'public', 'dreamfeed');

const STATIC = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/index.html': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/styles.css': { file: 'styles.css', type: 'text/css; charset=utf-8' },
  '/app.js': { file: 'app.js', type: 'text/javascript; charset=utf-8' },
  // Canonical Dreamfeed assets and token CSS are deliberately exposed through
  // fixed, read-only routes. The production cockpit does not import the
  // design-system React/CDN prototype or allow arbitrary docs paths.
  '/dreamfeed/assets/logo-lockup.svg': { path: path.join(DREAMFEED_SYSTEM_DIR, 'assets', 'logo-lockup.svg'), type: 'image/svg+xml' },
  '/dreamfeed/assets/logo-mark.svg': { path: path.join(DREAMFEED_SYSTEM_DIR, 'assets', 'logo-mark.svg'), type: 'image/svg+xml' },
  '/dreamfeed/tokens/colors.css': { path: path.join(DREAMFEED_SYSTEM_DIR, 'tokens', 'colors.css'), type: 'text/css; charset=utf-8' },
  '/dreamfeed/tokens/typography.css': { path: path.join(DREAMFEED_SYSTEM_DIR, 'tokens', 'typography.css'), type: 'text/css; charset=utf-8' },
  '/dreamfeed/fonts.css': { file: 'dreamfeed/fonts.css', type: 'text/css; charset=utf-8' },
  '/dreamfeed/fonts/IBMPlexSans-Regular.woff2': { file: 'dreamfeed/fonts/IBMPlexSans-Regular.woff2', type: 'font/woff2' },
  '/dreamfeed/fonts/IBMPlexSans-Medium.woff2': { file: 'dreamfeed/fonts/IBMPlexSans-Medium.woff2', type: 'font/woff2' },
  '/dreamfeed/fonts/IBMPlexSans-SemiBold.woff2': { file: 'dreamfeed/fonts/IBMPlexSans-SemiBold.woff2', type: 'font/woff2' },
  '/dreamfeed/fonts/IBMPlexSans-Bold.woff2': { file: 'dreamfeed/fonts/IBMPlexSans-Bold.woff2', type: 'font/woff2' },
  '/dreamfeed/fonts/IBMPlexMono-Regular.woff2': { file: 'dreamfeed/fonts/IBMPlexMono-Regular.woff2', type: 'font/woff2' },
  '/dreamfeed/fonts/IBMPlexMono-Medium.woff2': { file: 'dreamfeed/fonts/IBMPlexMono-Medium.woff2', type: 'font/woff2' },
  '/dreamfeed/fonts/IBMPlexMono-SemiBold.woff2': { file: 'dreamfeed/fonts/IBMPlexMono-SemiBold.woff2', type: 'font/woff2' },
  '/dreamfeed/fonts/IBMPlexMono-Bold.woff2': { file: 'dreamfeed/fonts/IBMPlexMono-Bold.woff2', type: 'font/woff2' },
};

function emptyState() {
  const now = new Date();
  return {
    generatedAt: now.toISOString(),
    asOfDate: now.toISOString().slice(0, 10),
    configured: false, readOnly: true, rootToken: null, isDefaultRoot: false,
    ui: { alias: 'Dreamfeed', canonicalName: 'Dreamfeed Command Center' },
    thresholdsSource: null, thresholds: {}, sources: [],
    strategicInitiatives: [], workItems: [], approvals: [], approvalQueue: [],
    discoveredGovernanceFiles: [],
    topology: { nodes: [], edges: [], repoInventory: [], tally: { Canonical: 0, Derived: 0, Candidate: 0 } },
    roadmap: [], milestones: [], reviews: [], learningSignals: [],
    parseErrors: [],
    counts: {
      strategicInitiatives: 0, workItems: 0, approvalsTotal: 0, decisionApprovals: 0,
      openDecisions: 0, dispatchGateApprovals: 0, conditionalGates: 0, pendingGates: 0,
      approvalQueue: 0, discoveredGovernanceFiles: 0, topologyNodes: 0, topologyEdges: 0,
      topologyCanonicalEdges: 0, topologyDerivedEdges: 0, roadmapPhases: 0,
      milestones: 0, reviews: 0, learningSignals: 0, parseErrors: 0,
    },
  };
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Dreamfeed is read-only: GET only.');
    return;
  }
  const url = req.url.split('?')[0];
  const params = new URLSearchParams(req.url.split('?')[1] || '');
  // Host check applies to all /api/* (cheap DNS-rebinding defense).
  if (url.startsWith('/api/') && !allowedHost(req)) {
    sendJson(res, 403, { error: 'host not allowed' });
    return;
  }
  if (url === '/api/project') {
    // State-changing GET when ?root= is present (transport stays GET-only; no
    // governance file is written — only the cockpit-local sidecar). no-store so a
    // cached response cannot return a stale rootToken/token.
    const rootParam = params.get('root');
    if (rootParam !== null) {
      // Mutation: require the local action guard + X-Dreamfeed-Token.
      const g = guardMutation(req);
      if (!g.ok) { sendJson(res, g.status, { error: g.error }); return; }
      if (rootParam === '') {
        // Clear project: sets currentRoot = null, retires the restore warning, persists.
        rememberRecent(currentRoot);
        currentRoot = null;
        restoreWarning = null;
        persistConfig();
        sendJson(res, 200, projectDescriptor(req));
        return;
      }
      const v = validateRoot(rootParam);
      if (!v.ok) { sendJson(res, 400, projectDescriptor(req, { error: v.error })); return; } // currentRoot unchanged
      rememberRecent(currentRoot);
      currentRoot = v.root;
      restoreWarning = null;
      const persistWarning = persistConfig();
      sendJson(res, 200, projectDescriptor(req, persistWarning ? { persistWarning } : {}));
      return;
    }
    // Read-only descriptor (bootstraps the action token to the same-origin page).
    sendJson(res, 200, projectDescriptor(req));
    return;
  }
  if (url === '/api/select-folder') {
    // Sensitive local action (opens a folder dialog): require the action guard.
    // SELECT ONLY — it returns a chosen path; it does NOT switch. The single
    // commit path remains /api/project?root=.
    const g = guardMutation(req);
    if (!g.ok) { sendJson(res, g.status, { error: g.error }); return; }
    const provider = params.get('provider') || 'nativeDialog';
    projectPicker.pick(provider)
      .then((result) => sendJson(res, result.error ? 400 : 200, result))
      .catch((err) => sendJson(res, 500, { error: String(err && err.message || err) }));
    return;
  }
  if (url === '/api/dirs') {
    // In-app folder browser: read-only directory listing. Sensitive (discloses
    // local folder names), so require the action guard. SELECT ONLY — navigation
    // does not switch; the single commit path remains /api/project?root=.
    const g = guardMutation(req);
    if (!g.ok) { sendJson(res, g.status, { error: g.error }); return; }
    const out = listDirs(params.get('path'));
    sendJson(res, out.error ? 400 : 200, out);
    return;
  }
  if (url === '/api/state') {
    if (!currentRoot) { sendJson(res, 200, emptyState()); return; }
    try {
      sendJson(res, 200, buildState({ repoRoot: currentRoot }));
    } catch (err) {
      sendJson(res, 500, { fatal: String(err.message || err) });
    }
    return;
  }
  if (url === '/api/repo-health') {
    try {
      sendJson(res, 200, getRepoHealth(currentRoot));
    } catch (err) {
      sendJson(res, 500, { fatal: String(err.message || err) });
    }
    return;
  }
  // Native-schema projections (D31; read-only GETs). Empty shapes when no
  // project or no os/ layout — degradation, never an error.
  if (url === '/api/queue') {
    try {
      const q = currentRoot ? buildQueue({ repoRoot: currentRoot }) : buildQueue({});
      sendJson(res, 200, { rootToken: currentRoot ? rootToken(currentRoot) : null, ...q });
    } catch (err) { sendJson(res, 500, { fatal: String(err.message || err) }); }
    return;
  }
  if (url === '/api/work') {
    try {
      const n = currentRoot ? buildNativeState({ repoRoot: currentRoot }) : buildNativeState({});
      sendJson(res, 200, { rootToken: currentRoot ? rootToken(currentRoot) : null, ...n });
    } catch (err) { sendJson(res, 500, { fatal: String(err.message || err) }); }
    return;
  }
  if (url === '/api/sprint') {
    try {
      const m = currentRoot ? buildSprintMetrics({ repoRoot: currentRoot }) : buildSprintMetrics({});
      sendJson(res, 200, { rootToken: currentRoot ? rootToken(currentRoot) : null, ...m });
    } catch (err) { sendJson(res, 500, { fatal: String(err.message || err) }); }
    return;
  }
  if (url === '/api/file') {
    if (!currentRoot) { sendJson(res, 409, { error: 'no project configured' }); return; }
    const token = params.get('token');
    const tok = rootToken(currentRoot);
    if (token !== null && token !== tok) {
      sendJson(res, 409, { error: 'project changed — refresh', rootToken: tok });
      return;
    }
    const out = readRepoFile(params.get('path'), currentRoot);
    sendJson(res, out.error ? 400 : 200, out);
    return;
  }
  const entry = STATIC[url];
  if (!entry) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found.');
    return;
  }
  fs.readFile(entry.path || path.join(PUBLIC_DIR, entry.file), (err, data) => {
    if (err) { res.writeHead(500); res.end('Static read error.'); return; }
    res.writeHead(200, { 'Content-Type': entry.type, 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Dreamfeed Command Center on http://127.0.0.1:${PORT}/ — localhost-only, read-only.`);
    console.log(currentRoot ? `Active project: ${currentRoot}` : 'No project configured — open the app and use the Project button to select a folder.');
    if (restoreWarning) console.log(`Note: ${restoreWarning}`);
  });
}

module.exports = {
  server, PORT, readRepoFile, validateRoot, projectDescriptor,
  localRequestGuard, guardMutation, ACTION_TOKEN,
  PROJECT_CONFIG_FILE,
  // Test-only accessors for the in-memory active root / recent list.
  _getCurrentRoot: () => currentRoot,
  _setCurrentRoot: (r) => { currentRoot = r; },
  _getRecent: () => recentRoots.slice(),
  _resetForTest: () => { currentRoot = null; recentRoots = []; restoreWarning = null; },
};
