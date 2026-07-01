'use strict';
// Project-switching tests (governed scope addition). Cover: root threading into
// buildState, root identity/token, file-viewer containment + realpath escape,
// /api/project validation, stale-root token rejection, token coherence across
// endpoints, root-aware audit gating, no-store headers, startup-restore
// fallback, and git hygiene for the persisted sidecar.
const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// Backstop: never open a real OS folder dialog from the test suite even if a
// fake provider injection is missed. (Picker tests still inject fakes, which
// override availability.)
process.env.DREAMFEED_NO_NATIVE = '1';

const { buildState } = require('../src/state');
const { getRepoHealth } = require('../src/repohealth');
const { REPO_ROOT, rootToken, canonicalRoot } = require('../src/parse');
const server = require('../src/server');
const projectPicker = require('../src/projectPicker');

const CC_DIR = path.join(__dirname, '..');

// --- fixture project --------------------------------------------------------
function writeFixtureRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'df-proj-'));
  const out = path.join(root, 'agents', 'founder', 'outputs');
  fs.mkdirSync(out, { recursive: true });
  const fm = (type, extra = '') => `---\ngovernance_type: ${type}\nstatus: active\ndate_modified: "2026-06-26"\n${extra}---\n`;
  fs.writeFileSync(path.join(out, 'strategic_initiatives.md'),
    fm('strategic_initiatives') + '# Strategic Initiatives\n\n| Initiative | Stage | Status | Owner | Success Definition |\n|---|---|---|---|---|\n| Test Initiative | crawl | active — building | Founder | It works |\n');
  fs.writeFileSync(path.join(out, 'weekly_priorities.md'),
    fm('weekly_priorities', 'sprint_week: "2026-06-22"\n') + '# Weekly Priorities\n\n| Rank | Action | Owner | Initiative | Est | Status |\n|---|---|---|---|---|---|\n| P1 | Do the thing | Founder | Test Initiative | 1h | active — now |\n');
  fs.writeFileSync(path.join(out, 'decision_queue.md'),
    fm('decision_queue') + '# Decision Queue\n\n| # | Decision | Consequence if deferred | Decision maker | Information needed |\n|---|---|---|---|---|\n| D1 | Decide it | bad | Founder | data |\n');
  fs.writeFileSync(path.join(out, 'agent_dispatch.md'),
    fm('agent_dispatch') + '# Agent Dispatch\n\n### Active Dispatches\n\n_None._\n');
  fs.writeFileSync(path.join(out, 'blocked_items.md'),
    fm('blocked_items') + '# Blocked Items\n\n| Blocked Item | Initiative | Blocking Condition | Unblocking Action |\n|---|---|---|---|\n| X | Test Initiative | because | do y |\n');
  return root;
}
function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* ignore */ } }

// --- root threading ---------------------------------------------------------
test('fixture-root: buildState reads a switched project and resolves evidence under it', () => {
  const root = writeFixtureRepo();
  try {
    const state = buildState({ repoRoot: root });
    assert.ok(state.strategicInitiatives.length >= 1, 'initiatives resolve from the fixture');
    assert.ok(state.workItems.length >= 1, 'work items resolve from the fixture');
    assert.strictEqual(state.isDefaultRoot, false, 'state knows it is not the default root');
    for (const o of [...state.strategicInitiatives, ...state.workItems]) {
      const abs = path.join(root, o.source_evidence.value.file);
      assert.ok(fs.existsSync(abs), `evidence resolves under the fixture root: ${o.source_evidence.value.file}`);
    }
    assert.notStrictEqual(state.rootToken, rootToken(REPO_ROOT), 'switched root has a distinct token');
  } finally { rmrf(root); }
});

test('switched repo missing the governance layout degrades to parseErrors, never throws', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'df-empty-'));
  try {
    const state = buildState({ repoRoot: root });
    assert.ok(Array.isArray(state.parseErrors) && state.parseErrors.length > 0, 'missing files become parse errors');
    assert.strictEqual(state.strategicInitiatives.length, 0, 'no objects, no crash');
  } finally { rmrf(root); }
});

// --- root identity / token --------------------------------------------------
test('canonical-identity: equivalent spellings of a root share one token', () => {
  assert.strictEqual(rootToken(REPO_ROOT), rootToken(REPO_ROOT + path.sep), 'trailing separator is canonicalized');
  if (process.platform === 'win32') {
    assert.strictEqual(rootToken(REPO_ROOT), rootToken(REPO_ROOT.toUpperCase()), 'case variants are canonicalized on Windows');
  }
});

// --- file-viewer containment ------------------------------------------------
test('readRepoFile: containment is computed against the active root', () => {
  const root = writeFixtureRepo();
  try {
    const ok = server.readRepoFile('agents/founder/outputs/strategic_initiatives.md', root);
    assert.ok(!ok.error, `expected a read, got ${ok.error}`);
    assert.ok(server.readRepoFile('../escape.md', root).error, 'traversal rejected against active root');
    assert.ok(server.readRepoFile('agents/founder/outputs/strategic_initiatives.md').path, 'default root still reads the Stakeport repo');
  } finally { rmrf(root); }
});

test('realpath-escape: a symlink inside the root pointing outside it is rejected', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'df-link-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'df-out-'));
  try {
    fs.writeFileSync(path.join(outside, 'secret.md'), 'secret');
    const linkPath = path.join(root, 'escape.md');
    try { fs.symlinkSync(path.join(outside, 'secret.md'), linkPath); }
    catch { return t.skip('symlink creation not permitted in this environment'); }
    const r = server.readRepoFile('escape.md', root);
    assert.ok(r.error, 'symlink escaping the root must be rejected');
  } finally { rmrf(root); rmrf(outside); }
});

// --- /api/project validation ------------------------------------------------
test('validateRoot rejects relative, missing, and non-directory paths', () => {
  const root = writeFixtureRepo();
  try {
    assert.ok(!server.validateRoot('relative/path').ok, 'relative rejected');
    assert.ok(!server.validateRoot(path.join(root, 'nope')).ok, 'missing rejected');
    assert.ok(!server.validateRoot(path.join(root, 'agents', 'founder', 'outputs', 'strategic_initiatives.md')).ok, 'a file is not a project root');
    assert.ok(server.validateRoot(root).ok, 'a real directory is accepted');
  } finally { rmrf(root); }
});

// --- root-aware audit gating ------------------------------------------------
test('audit-root: a switched project shows git state only, never the Stakeport audit', () => {
  const root = writeFixtureRepo();
  try {
    const h = getRepoHealth(root);
    assert.strictEqual(h.readOnly, true);
    assert.strictEqual(h.auditConfigured, false, 'no harness configured for a foreign project');
    assert.strictEqual(h.audit.everRun, false, 'no foreign audit displayed');
    assert.deepStrictEqual(h.validationCommands, [], 'no Stakeport validation commands for a foreign project');
  } finally { rmrf(root); }
});

// --- HTTP surface (server) --------------------------------------------------
let base;
before(async () => {
  if (server._resetForTest) server._resetForTest(); else server._setCurrentRoot(REPO_ROOT);
  await new Promise((resolve) => server.server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.server.address().port}`;
});
after(() => {
  server.server.close();
  try { fs.rmSync(server.PROJECT_CONFIG_FILE, { force: true }); } catch { /* ignore */ }
  if (server._resetForTest) server._resetForTest(); else server._setCurrentRoot(REPO_ROOT);
});

// The real token is exported for unit tests; over HTTP it arrives in the descriptor.
async function fetchToken() { return (await (await fetch(base + '/api/project')).json()).actionToken; }
function switchTo(p, headers = {}) {
  return fetch(base + '/api/project?root=' + encodeURIComponent(p), { headers });
}

test('no-store: every JSON endpoint, including /api/project, forbids caching', async () => {
  for (const route of ['/api/state', '/api/repo-health', '/api/file?path=CLAUDE.md', '/api/project']) {
    const res = await fetch(base + route);
    assert.strictEqual(res.headers.get('cache-control'), 'no-store', `${route} is no-store`);
  }
});

test('token-coherence: /api/state and /api/repo-health describe the same active root', async () => {
  server._setCurrentRoot(REPO_ROOT);
  const st = await (await fetch(base + '/api/state')).json();
  const h = await (await fetch(base + '/api/repo-health')).json();
  assert.ok(st.rootToken, 'state carries a root token');
  assert.strictEqual(st.rootToken, h.rootToken, 'state and repo-health agree on the active root');
});

test('stale-token: /api/file rejects a read whose token no longer matches the active root', async () => {
  const res = await fetch(base + '/api/file?path=CLAUDE.md&token=deadbeefdead');
  assert.strictEqual(res.status, 409, 'stale token is rejected');
  const body = await res.json();
  assert.match(body.error, /project changed/i);
});

test('/api/project (authorized) switches to a valid folder and rejects an invalid one', async () => {
  const root = writeFixtureRepo();
  try {
    const token = await fetchToken();
    const ok = await (await switchTo(root, { 'X-Dreamfeed-Token': token })).json();
    assert.strictEqual(ok.isDefault, false, 'switched off the default');
    assert.strictEqual(ok.rootToken, rootToken(canonicalRoot(root)), 'descriptor token matches the canonical root');
    const stAfter = await (await fetch(base + '/api/state')).json();
    assert.strictEqual(stAfter.rootToken, ok.rootToken, 'state now reads the switched project');

    const badRes = await switchTo(path.join(root, 'nope'), { 'X-Dreamfeed-Token': token });
    assert.strictEqual(badRes.status, 400, 'invalid root rejected');
    const stStill = await (await fetch(base + '/api/state')).json();
    assert.strictEqual(stStill.rootToken, ok.rootToken, 'a rejected switch leaves the active root unchanged');

    await switchTo(REPO_ROOT, { 'X-Dreamfeed-Token': token }); // reset to default
  } finally { rmrf(root); }
});

test('action guard: tokenless and cross-site switches are rejected; missing Origin is fine', async () => {
  const root = writeFixtureRepo();
  try {
    const token = await fetchToken();
    // tokenless mutation
    assert.strictEqual((await switchTo(root)).status, 403, 'tokenless switch rejected');
    // forged cross-site fetch metadata, even with a token
    assert.strictEqual((await switchTo(root, { 'X-Dreamfeed-Token': token, 'Sec-Fetch-Site': 'cross-site' })).status, 403, 'cross-site switch rejected');
    // valid token, no Origin/Referer header (node fetch omits them) → accepted
    const ok = await switchTo(root, { 'X-Dreamfeed-Token': token });
    assert.strictEqual(ok.status, 200, 'authorized switch without Origin/Referer succeeds');
    await switchTo(REPO_ROOT, { 'X-Dreamfeed-Token': token });
  } finally { rmrf(root); }
});

test('action guard: select-folder requires the token', async () => {
  const res = await fetch(base + '/api/select-folder'); // no token
  assert.strictEqual(res.status, 403, 'tokenless select-folder rejected');
});

// Host / origin / port matrix via the exported guard (no real socket needed).
test('localRequestGuard: host allowlist (incl. [::1]), port match, optional origin', () => {
  const mk = (headers, localPort = 5555) => ({ headers, socket: { localPort } });
  const ok = (h, p) => server.localRequestGuard(mk(h, p)).ok;
  assert.ok(ok({ host: '127.0.0.1:5555' }), 'loopback v4 + matching port');
  assert.ok(ok({ host: 'localhost:5555' }), 'localhost + matching port');
  assert.ok(ok({ host: '[::1]:5555' }), 'IPv6 [::1] + matching port');
  assert.ok(ok({ host: 'localhost' }), 'bare host (default-port) accepted');
  assert.ok(!ok({ host: 'evil.example.com:5555' }), 'foreign host (rebinding) rejected');
  assert.ok(!ok({ host: '127.0.0.1:6666' }, 5555), 'wrong port rejected');
  assert.ok(!ok({ host: 'localhost:5555', 'sec-fetch-site': 'cross-site' }), 'cross-site rejected');
  assert.ok(ok({ host: 'localhost:5555', 'sec-fetch-site': 'same-origin' }), 'same-origin allowed');
  assert.ok(ok({ host: 'localhost:5555' }), 'absent Sec-Fetch-Site allowed');
  assert.ok(ok({ host: 'localhost:5555', origin: 'http://localhost:5555' }), 'matching origin allowed');
  assert.ok(!ok({ host: 'localhost:5555', origin: 'http://evil.example.com' }), 'foreign origin rejected');
  // A claimed port that cannot be verified (no known listening port) is rejected,
  // not silently accepted (port-pin must not degrade to host-name-only).
  const noPortReq = (headers) => ({ headers, socket: {} });
  assert.ok(!server.localRequestGuard(noPortReq({ host: 'localhost:5555' })).ok, 'claimed port with unknown listen port rejected');
  assert.ok(server.localRequestGuard(noPortReq({ host: 'localhost' })).ok, 'bare host with unknown listen port still allowed');
  assert.ok(!ok({ host: 'localhost:abc' }), 'malformed host (non-numeric port) rejected');
});

test('isDefaultRoot: the realpath-canonicalized default is still recognized as default', () => {
  // Regression: state must use canonical identity, not raw string equality, so a
  // reset-to-default (which stores canonicalRoot(REPO_ROOT)) is not mislabeled.
  const st = buildState({ repoRoot: canonicalRoot(REPO_ROOT) });
  assert.strictEqual(st.isDefaultRoot, true, 'canonicalized default root reads as default');
});

test('native picker is disabled under the DREAMFEED_NO_NATIVE backstop', () => {
  assert.strictEqual(projectPicker.nativeAvailable(), false, 'no real OS dialog can fire in the test process');
});

test('/api/dirs: in-app folder browser lists subfolders (guarded, read-only)', async () => {
  const root = writeFixtureRepo();
  try {
    // sensitive (discloses local folder structure) → token required
    assert.strictEqual((await fetch(base + '/api/dirs?path=' + encodeURIComponent(root))).status, 403, 'tokenless dir listing rejected');
    const token = await fetchToken();
    const data = await (await fetch(base + '/api/dirs?path=' + encodeURIComponent(root), { headers: { 'X-Dreamfeed-Token': token } })).json();
    assert.strictEqual(data.path, path.resolve(root), 'echoes the resolved path');
    assert.ok(data.entries.map((e) => e.name).includes('agents'), 'lists the agents/ subfolder');
    assert.ok(data.entries.every((e) => e.name && e.path), 'entries carry name + absolute path');
    assert.ok('parent' in data, 'exposes parent for up-navigation');
    assert.ok(Array.isArray(data.drives), 'exposes a drives array');
    // a file path resolves to its containing directory, not an error
    const f = await (await fetch(base + '/api/dirs?path=' + encodeURIComponent(path.join(root, 'agents', 'founder', 'outputs', 'agent_dispatch.md')), { headers: { 'X-Dreamfeed-Token': token } })).json();
    assert.strictEqual(f.path, path.resolve(path.join(root, 'agents', 'founder', 'outputs')), 'a file path lists its parent directory');
  } finally { rmrf(root); }
});

// --- picker adapter (fake provider; never opens a real dialog) ---------------
test('picker adapter: fake provider returns a path; cancel leaves project unchanged', async () => {
  const root = writeFixtureRepo();
  const restore = projectPicker.__setProviderForTest('nativeDialog', { available: () => true, pick: async () => ({ path: root }) });
  try {
    const token = await fetchToken();
    const picked = await (await fetch(base + '/api/select-folder', { headers: { 'X-Dreamfeed-Token': token } })).json();
    assert.strictEqual(picked.path, root, 'select-folder returns the fake-picked path (does NOT switch)');
    const before = (await (await fetch(base + '/api/project')).json()).currentRoot;
    // The commit is a separate /api/project call.
    const sw = await (await switchTo(root, { 'X-Dreamfeed-Token': token })).json();
    assert.strictEqual(sw.isDefault, false, 'separate commit switched the project');
    assert.notStrictEqual(before, sw.currentRoot, 'select-folder alone did not change currentRoot');
    await switchTo(REPO_ROOT, { 'X-Dreamfeed-Token': token });
  } finally { restore(); rmrf(root); }
});

test('picker adapter: cancel path returns {cancelled} and never switches', async () => {
  const restore = projectPicker.__setProviderForTest('nativeDialog', { available: () => true, pick: async () => ({ cancelled: true }) });
  try {
    const token = await fetchToken();
    const before = (await (await fetch(base + '/api/project')).json()).currentRoot;
    const picked = await (await fetch(base + '/api/select-folder', { headers: { 'X-Dreamfeed-Token': token } })).json();
    assert.ok(picked.cancelled, 'cancel surfaced');
    const after = (await (await fetch(base + '/api/project')).json()).currentRoot;
    assert.strictEqual(before, after, 'cancel left the active project unchanged');
  } finally { restore(); }
});

test('recent projects: a successful switch lists the prior project, capped/deduped', async () => {
  const a = writeFixtureRepo(); const b = writeFixtureRepo();
  try {
    const token = await fetchToken();
    await switchTo(a, { 'X-Dreamfeed-Token': token });
    const afterB = await (await switchTo(b, { 'X-Dreamfeed-Token': token })).json();
    const recentPaths = (afterB.recent || []).map((r) => r.path.toLowerCase());
    assert.ok(recentPaths.includes(canonicalRoot(a).toLowerCase()), 'prior project A is now recent');
    assert.ok(!recentPaths.includes(canonicalRoot(REPO_ROOT).toLowerCase()), 'default is never listed as recent');
    await switchTo(REPO_ROOT, { 'X-Dreamfeed-Token': token });
  } finally { rmrf(a); rmrf(b); }
});

// --- startup restore (child process) ----------------------------------------
test('startup-restore: an unavailable saved project falls back to default with a warning', () => {
  const cfg = path.join(CC_DIR, 'project-config.json');
  const existed = fs.existsSync(cfg);
  const backup = existed ? fs.readFileSync(cfg) : null;
  try {
    fs.writeFileSync(cfg, JSON.stringify({ root: path.join(os.tmpdir(), 'df-does-not-exist-xyz') }));
    const serverPath = path.join(CC_DIR, 'src', 'server.js');
    const code = `const s=require(${JSON.stringify(serverPath)});const d=s.projectDescriptor();process.stdout.write(JSON.stringify({isDefault:d.isDefault,warn:!!d.restoreWarning}));`;
    const out = execFileSync(process.execPath, ['-e', code], { encoding: 'utf8' });
    const d = JSON.parse(out);
    assert.strictEqual(d.isDefault, true, 'falls back to the default root');
    assert.strictEqual(d.warn, true, 'surfaces a non-blocking restore warning');
  } finally {
    if (backup) fs.writeFileSync(cfg, backup); else fs.rmSync(cfg, { force: true });
  }
});

// --- git hygiene ------------------------------------------------------------
test('git-hygiene: the persisted project sidecar is git-ignored', () => {
  const out = execFileSync('git', ['check-ignore', 'tools/command-center/project-config.json'],
    { cwd: REPO_ROOT, encoding: 'utf8', windowsHide: true });
  assert.match(out.trim(), /project-config\.json$/, 'sidecar must be ignored, never committed');
});
