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
const { discover } = require('./discovery');
const { readManifest } = require('./topology');
const { computePlan } = require('./commands/plans');
const { loadPolicy } = require('./commands/policy');
const { approvePlan, executePlan, rollbackExecution } = require('./commands/executor');
const cpStore = require('./commands/store');
const { appendEvent, readLedger, verifyChain } = require('./commands/ledger');
const { runAssistant, isConfigured: assistantConfigured } = require('./assistant/adapter');
const { listMemories, retrieveMemories, exportMemories, safeMemorySummary } = require('./memory');
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
// D32 discovery cache: one scan per active root per process, invalidated by
// project switch (key mismatch) or an explicit ?rescan=1.
let discoveryCache = { key: null, data: null };
function clearDiscoveryCacheFor(repoRoot) {
  if (!repoRoot) { discoveryCache = { key: null, data: null }; return; }
  const key = rootToken(repoRoot);
  if (discoveryCache.key === key) discoveryCache = { key: null, data: null };
}
function discoveryForRoot(repoRoot) {
  const data = discover(repoRoot);
  const manifest = readManifest(repoRoot);
  const promotedSources = new Set(manifest.nodes
    .map((n) => n.promoted_from && !n.promoted_from.nys ? n.promoted_from.value : null)
    .filter(Boolean));
  if (!promotedSources.size) return data;
  return {
    ...data,
    candidates: data.candidates.filter((c) => !promotedSources.has(c.sourcePath)),
  };
}

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
// project root — null until the user picks one; the cockpit is project-
// agnostic and may be pointed at ANY local folder (a governance repo, a plain
// code repo, or an empty directory — each lens degrades per its contract).
// The choice persists across restart in a cockpit-local sidecar (never a
// governance/source file). One active project per server: all tabs share it.
// Remote (e.g. GitHub) repos must be cloned locally first — outbound egress
// beyond the assistant adapter is outside the Gate G envelope.
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
    assistant: { configured: assistantConfigured() },
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
  '/layout.js': { file: 'layout.js', type: 'text/javascript; charset=utf-8' },
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

// ---------------------------------------------------------------------------
// Gate G mutating surface (D31). The ONLY route+method pairs that accept
// non-GET requests; anything else stays 405 exactly as under Gate F. Every
// entry is behind guardMutationStrict + the governed lifecycle. Exported so
// test/constraints.test.js enforces this table behaviorally.
// ---------------------------------------------------------------------------
const MUTATING_ROUTES = Object.freeze({
  '/api/intents': ['POST'],
  '/api/intents/:id/plan': ['POST'],
  '/api/plans/:id/approve': ['POST'],
  '/api/plans/:id/execute': ['POST'],
  '/api/executions/:id/rollback': ['POST'],
  '/api/work/tasks/transition': ['POST'],
  '/api/assistant/:mode/messages': ['POST'],
});
const BODY_CAP = 1024 * 1024;

function matchMutating(url) {
  const segs = url.split('/').filter(Boolean);
  for (const [pattern, methods] of Object.entries(MUTATING_ROUTES)) {
    const pSegs = pattern.split('/').filter(Boolean);
    if (pSegs.length !== segs.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < pSegs.length; i++) {
      if (pSegs[i].startsWith(':')) {
        // A malformed percent-escape must not throw out of the request handler
        // (that would crash the process); treat it as a non-match instead.
        try { params[pSegs[i].slice(1)] = decodeURIComponent(segs[i]); }
        catch { ok = false; break; }
      } else if (pSegs[i] !== segs[i]) { ok = false; break; }
    }
    if (ok) return { pattern, methods, params };
  }
  return null;
}

// Non-GET guard: everything guardMutation checks, PLUS a present loopback
// Origin header (browsers always send Origin on non-GET fetch; its absence
// marks a non-browser client that must still present the token) is NOT
// required — the token remains the gate — but when Origin/Referer are present
// they must be loopback (originRefererOk inside localRequestGuard).
function readJsonBody(req, cb) {
  const chunks = [];
  let size = 0;
  let done = false;
  req.on('data', (c) => {
    if (done) return;
    size += c.length;
    if (size > BODY_CAP) { done = true; cb({ error: 'body too large', status: 413 }); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    if (done) return;
    done = true;
    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw.trim()) { cb(null, {}); return; }
    const ct = String(req.headers['content-type'] || '');
    if (!ct.includes('application/json')) { cb({ error: 'Content-Type must be application/json', status: 415 }); return; }
    try { cb(null, JSON.parse(raw)); } catch { cb({ error: 'invalid JSON body', status: 400 }); }
  });
  req.on('error', () => { if (!done) { done = true; cb({ error: 'request aborted', status: 400 }); } });
}

// Map engine error codes to HTTP statuses.
const CODE_STATUS = {
  'validation': 400, 'not-found': 404, 'containment': 404, 'no-project': 409,
  'drift': 409, 'root-drift': 409, 'state': 409, 'busy': 409, 'approval': 409,
  'unsafe': 409, 'diverged': 409, 'no-preimage': 409, 'confirm-required': 403,
  'policy-denied': 422, 'io': 500, 'not-configured': 501,
};
function sendEngineError(res, out) {
  sendJson(res, CODE_STATUS[out.code] || 400, { error: out.error, code: out.code });
}

function guardSensitiveRead(req, res) {
  const g = guardMutation(req);
  if (!g.ok) {
    sendJson(res, g.status, { error: g.error });
    return false;
  }
  if (!currentRoot) {
    sendJson(res, 409, { error: 'no project configured', code: 'no-project' });
    return false;
  }
  return true;
}

function assistantMemoryContext(message, visibleContext) {
  if (!currentRoot) return { context: '', used: [], strategy: 'structured-keyword', vectorReady: true };
  const query = [message, visibleContext].filter(Boolean).join(' ');
  const retrieved = retrieveMemories({ repoRoot: currentRoot, query, limit: 5 });
  return {
    context: retrieved.context,
    used: retrieved.used.map(safeMemorySummary),
    strategy: retrieved.strategy,
    vectorReady: retrieved.vectorReady,
  };
}

function handleMutation(req, res, url, body) {
  const m = matchMutating(url);
  const { params } = m;
  const policy = loadPolicy(currentRoot);

  if (m.pattern === '/api/intents') {
    const kind = String(body.kind || '');
    if (!kind || kind.length > 64) { sendJson(res, 400, { error: 'intent kind required', code: 'validation' }); return; }
    const intent = cpStore.create('intents', 'int', { kind, payload: body.payload || {}, rootToken: currentRoot ? rootToken(currentRoot) : null });
    appendEvent({ type: 'intent-created', intentId: intent.id, kind });
    sendJson(res, 201, { intent });
    return;
  }
  if (m.pattern === '/api/intents/:id/plan') {
    const intent = cpStore.get('intents', params.id);
    if (!intent) { sendJson(res, 404, { error: 'intent not found', code: 'not-found' }); return; }
    // Workspace isolation: an intent is bound to the project it was raised
    // under. If the active project changed since, refuse rather than silently
    // plan (and, for auto-class, execute) against a different repo.
    const curTok = currentRoot ? rootToken(currentRoot) : null;
    if (intent.rootToken !== curTok) {
      sendJson(res, 409, { error: 'intent was created for a different project — recreate it', code: 'root-drift' });
      return;
    }
    const out = computePlan(intent, { repoRoot: currentRoot, policy });
    if (out.error) { sendEngineError(res, out); return; }
    const plan = cpStore.create('plans', 'pln', out.plan);
    appendEvent({ type: 'plan-computed', intentId: intent.id, planId: plan.id, planHash: plan.planHash, class: plan.class, summary: plan.summary });
    // auto class: policy itself is the approval authority (still ledgered).
    if (plan.class === 'auto') {
      const a = approvePlan(plan, { actor: 'policy:auto' }, currentRoot);
      if (a.error) { sendEngineError(res, a); return; }
      sendJson(res, 200, { plan, approval: a.approval });
      return;
    }
    sendJson(res, 200, { plan });
    return;
  }
  if (m.pattern === '/api/plans/:id/approve') {
    const plan = cpStore.get('plans', params.id);
    if (!plan) { sendJson(res, 404, { error: 'plan not found', code: 'not-found' }); return; }
    const out = approvePlan(plan, { actor: 'operator', confirm: body.confirm }, currentRoot);
    if (out.error) { sendEngineError(res, out); return; }
    sendJson(res, 200, { plan, approval: out.approval });
    return;
  }
  if (m.pattern === '/api/plans/:id/execute') {
    const plan = cpStore.get('plans', params.id);
    if (!plan) { sendJson(res, 404, { error: 'plan not found', code: 'not-found' }); return; }
    const out = executePlan(plan, { actor: 'operator', health: getRepoHealth(currentRoot) }, currentRoot);
    if (out.error) { sendEngineError(res, out); return; }
    if (plan.opName === 'promote-topology' && out.execution && out.execution.status === 'succeeded') {
      clearDiscoveryCacheFor(currentRoot);
    }
    sendJson(res, 200, { execution: out.execution });
    return;
  }
  if (m.pattern === '/api/executions/:id/rollback') {
    const execution = cpStore.get('executions', params.id);
    if (!execution) { sendJson(res, 404, { error: 'execution not found', code: 'not-found' }); return; }
    const out = rollbackExecution(execution, { actor: 'operator', confirm: body.confirm }, currentRoot, policy);
    if (out.error) { sendEngineError(res, out); return; }
    sendJson(res, 200, { execution: out.execution });
    return;
  }
  if (m.pattern === '/api/assistant/:mode/messages') {
    // Assistant proxy (D31): outbound only via the adapter's configured
    // endpoint; the context string is client-built and operator-visible.
    const memory = assistantMemoryContext(body.message, body.context);
    const context = [body.context, memory.context].filter(Boolean).join('\n\n');
    return runAssistant(params.mode, body.message, context).then((out) => {
      if (out.error) { sendEngineError(res, out); return; }
      sendJson(res, 200, { reply: out.reply, mode: params.mode, memory });
    });
  }
  if (m.pattern === '/api/work/tasks/transition') {
    // Daily-queue sugar: intent + plan in one call; auto-class plans execute
    // immediately (fully ledgered); approve-class plans come back pending.
    const intent = cpStore.create('intents', 'int', { kind: 'task-transition', payload: { taskId: body.taskId, to: body.to }, rootToken: currentRoot ? rootToken(currentRoot) : null });
    appendEvent({ type: 'intent-created', intentId: intent.id, kind: intent.kind });
    const out = computePlan(intent, { repoRoot: currentRoot, policy });
    if (out.error) { sendEngineError(res, out); return; }
    const plan = cpStore.create('plans', 'pln', out.plan);
    appendEvent({ type: 'plan-computed', intentId: intent.id, planId: plan.id, planHash: plan.planHash, class: plan.class, summary: plan.summary });
    if (plan.class !== 'auto') { sendJson(res, 202, { intent, plan, pending: 'approval' }); return; }
    const a = approvePlan(plan, { actor: 'policy:auto' }, currentRoot);
    if (a.error) { sendEngineError(res, a); return; }
    const x = executePlan(plan, { actor: 'operator', health: getRepoHealth(currentRoot) }, currentRoot);
    if (x.error) { sendEngineError(res, x); return; }
    sendJson(res, 200, { intent, plan, execution: x.execution });
    return;
  }
  sendJson(res, 404, { error: 'not found', code: 'not-found' });
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET') {
    const m = matchMutating(req.url.split('?')[0]);
    if (!m || !m.methods.includes(req.method)) {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method not allowed. Mutations exist only on the governed lifecycle routes (D31).');
      return;
    }
    const g = guardMutation(req);
    if (!g.ok) { sendJson(res, g.status, { error: g.error }); return; }
    readJsonBody(req, (err, body) => {
      if (err) { sendJson(res, err.status, { error: err.error }); return; }
      try {
        Promise.resolve(handleMutation(req, res, req.url.split('?')[0], body))
          .catch((e) => { if (!res.headersSent) sendJson(res, 500, { error: String(e.message || e) }); });
      } catch (e) { if (!res.headersSent) sendJson(res, 500, { error: String(e.message || e) }); }
    });
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
  // D32 adoption bridge: deterministic discovery over the active root only
  // (read-only GET; realpath-contained inside the scanner). Cached per root;
  // ?rescan=1 forces a fresh walk.
  if (url === '/api/discovery') {
    if (!currentRoot) { sendJson(res, 200, { configured: false, candidates: [], rollups: [], warnings: [], errors: [] }); return; }
    try {
      const key = rootToken(currentRoot);
      if (params.get('rescan') !== '1' && discoveryCache.key === key) { sendJson(res, 200, discoveryCache.data); return; }
      const data = { rootToken: key, ...discoveryForRoot(currentRoot) };
      discoveryCache = { key, data };
      sendJson(res, 200, data);
    } catch (err) { sendJson(res, 500, { fatal: String(err.message || err) }); }
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
  if (url === '/api/ledger') {
    try {
      const after = parseInt(params.get('after') || '0', 10) || 0;
      sendJson(res, 200, { events: readLedger({ after }), chain: verifyChain() });
    } catch (err) { sendJson(res, 500, { fatal: String(err.message || err) }); }
    return;
  }
  if (url === '/api/memory') {
    if (!guardSensitiveRead(req, res)) return;
    try {
      const query = params.get('q') || '';
      const kind = params.get('kind') || undefined;
      const includeArchived = params.get('includeArchived') === '1';
      const includeDeleted = params.get('includeDeleted') === '1';
      const stateFilter = params.get('state') || undefined;
      const memories = query
        ? retrieveMemories({ repoRoot: currentRoot, query, kind, limit: parseInt(params.get('limit') || '50', 10) || 50 }).used
        : listMemories({ repoRoot: currentRoot, state: stateFilter || (includeArchived ? undefined : 'active'), kind, includeDeleted });
      sendJson(res, 200, {
        rootToken: currentRoot ? rootToken(currentRoot) : null,
        retrieval: { strategy: 'structured-keyword', vectorReady: true },
        memories,
      });
    } catch (err) { sendJson(res, 500, { fatal: String(err.message || err) }); }
    return;
  }
  if (url === '/api/memory/export') {
    if (!guardSensitiveRead(req, res)) return;
    try {
      sendJson(res, 200, exportMemories({ repoRoot: currentRoot, includeDeleted: params.get('includeDeleted') === '1' }));
    } catch (err) { sendJson(res, 500, { fatal: String(err.message || err) }); }
    return;
  }
  if (url === '/api/lifecycle') {
    try { sendJson(res, 200, cpStore.snapshot()); }
    catch (err) { sendJson(res, 500, { fatal: String(err.message || err) }); }
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
  MUTATING_ROUTES,
  PROJECT_CONFIG_FILE,
  // Test-only accessors for the in-memory active root / recent list.
  _getCurrentRoot: () => currentRoot,
  _setCurrentRoot: (r) => { currentRoot = r; },
  _getRecent: () => recentRoots.slice(),
  _resetForTest: () => { currentRoot = null; recentRoots = []; restoreWarning = null; },
};
