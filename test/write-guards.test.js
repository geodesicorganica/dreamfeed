'use strict';
// Gate G write-guard suite (D31): approval requirements, containment, drift
// detection, policy denial, rollback, halt — at unit and HTTP layers, over a
// TEMP COPY of the dreamfeed-native fixture (the checked-in fixture is never
// mutated). Control-plane records go to an isolated temp sidecar.
const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

process.env.DREAMFEED_NO_NATIVE = '1';
process.env.DREAMFEED_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'df-state-'));

const server = require('../src/server');
const { resolveForWrite, writeRepoFile, hashText } = require('../src/write');
const { computePlan } = require('../src/commands/plans');
const { readLedger } = require('../src/commands/ledger');

const FIXTURE = path.join(__dirname, 'fixtures', 'dreamfeed-native');
let PROJ; // temp copy of the fixture, git-initialized
let base, token;

function git(args) { return execFileSync('git', args, { cwd: PROJ, encoding: 'utf8' }); }

before(async () => {
  PROJ = fs.mkdtempSync(path.join(os.tmpdir(), 'df-proj-'));
  fs.cpSync(FIXTURE, PROJ, { recursive: true });
  git(['init', '-b', 'main']);
  git(['config', 'user.email', 'test@dreamfeed.local']);
  git(['config', 'user.name', 'Dreamfeed Test']);
  git(['add', '-A']);
  git(['commit', '-m', 'fixture baseline']);
  server._setCurrentRoot(PROJ);
  await new Promise((resolve) => server.server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.server.address().port}`;
  token = (await (await fetch(base + '/api/project')).json()).actionToken;
});
after(() => {
  server.server.close();
  if (server._resetForTest) server._resetForTest();
  try { fs.rmSync(PROJ, { recursive: true, force: true }); } catch { /* ignore */ }
});

function post(route, body = {}) {
  return fetch(base + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Dreamfeed-Token': token, Origin: base },
    body: JSON.stringify(body),
  });
}

// --- containment (unit) ---------------------------------------------------------

test('containment: traversal, absolute paths, .git, and extensions are rejected for writes', () => {
  assert.match(resolveForWrite('../outside.md', PROJ).error, /traversal/);
  assert.match(resolveForWrite('os/../../outside.md', PROJ).error, /traversal/);
  assert.match(resolveForWrite('C:/temp/x.md', PROJ).error, /repo-relative/);
  assert.match(resolveForWrite('.git/config.txt', PROJ).error, /not writable/);
  assert.match(resolveForWrite('os/goals/ship-cockpit.js', PROJ).error, /extension/);
  assert.ok(resolveForWrite('os/goals/ship-cockpit.md', PROJ).ok);
});

test('containment: write drift detection at the file layer', () => {
  const rel = 'os/blockers.md';
  const current = fs.readFileSync(path.join(PROJ, rel), 'utf8');
  const stale = writeRepoFile(rel, 'x', PROJ, { baseHash: hashText(current + 'changed') });
  assert.strictEqual(stale.code, 'drift');
  assert.strictEqual(fs.readFileSync(path.join(PROJ, rel), 'utf8'), current, 'file untouched on drift');
});

// --- policy (unit) ---------------------------------------------------------------

test('policy: unknown kinds and denied classes are unplannable', () => {
  const denyAll = { classes: {} };
  const out = computePlan({ id: 'int_x', kind: 'task-transition', payload: { taskId: 'ship-cockpit:T2', to: 'active' } }, { repoRoot: PROJ, policy: denyAll });
  assert.strictEqual(out.code, 'policy-denied');
  const bad = computePlan({ id: 'int_y', kind: 'rm-rf-everything', payload: {} }, { repoRoot: PROJ, policy: denyAll });
  assert.strictEqual(bad.code, 'validation');
});

// --- HTTP lifecycle ---------------------------------------------------------------

test('auto class: task transition executes end-to-end and is fully ledgered', async () => {
  const res = await post('/api/work/tasks/transition', { taskId: 'ship-cockpit:T2', to: 'active' });
  assert.strictEqual(res.status, 200);
  const out = await res.json();
  assert.strictEqual(out.execution.status, 'succeeded');
  const content = fs.readFileSync(path.join(PROJ, 'os/goals/ship-cockpit.md'), 'utf8');
  assert.match(content, /\| T2 \| Wire drift detection \| active \|/);
  const events = (await (await fetch(base + '/api/ledger')).json());
  assert.strictEqual(events.chain.ok, true);
  const types = events.events.map((e) => e.type);
  for (const t of ['intent-created', 'plan-computed', 'approval', 'execution-started', 'op-applied', 'execution-succeeded']) {
    assert.ok(types.includes(t), `ledger missing ${t}`);
  }
});

test('drift: execution refuses when the source changed after approval', async () => {
  const ir = await post('/api/intents', { kind: 'task-transition', payload: { taskId: 'ship-cockpit:T3', to: 'active' } });
  const { intent } = await ir.json();
  const pr = await post(`/api/intents/${intent.id}/plan`);
  assert.strictEqual(pr.status, 200);
  const { plan } = await pr.json(); // auto class → already approved
  const goalPath = path.join(PROJ, 'os/goals/ship-cockpit.md');
  const original = fs.readFileSync(goalPath, 'utf8');
  fs.writeFileSync(goalPath, original + '\n<!-- external edit -->\n', 'utf8');
  const xr = await post(`/api/plans/${plan.id}/execute`);
  assert.strictEqual(xr.status, 409);
  assert.strictEqual((await xr.json()).code, 'drift');
  fs.writeFileSync(goalPath, original, 'utf8'); // restore
});

test('approve class: git-add requires explicit approval before execution', async () => {
  fs.writeFileSync(path.join(PROJ, 'scratch-note.md'), 'untracked\n', 'utf8');
  const ir = await post('/api/intents', { kind: 'git-add', payload: { paths: ['scratch-note.md'] } });
  const { intent } = await ir.json();
  const pr = await post(`/api/intents/${intent.id}/plan`);
  const body = await pr.json();
  assert.strictEqual(body.plan.class, 'approve');
  assert.strictEqual(body.approval, undefined, 'approve class is not auto-approved');
  const early = await post(`/api/plans/${body.plan.id}/execute`);
  assert.strictEqual(early.status, 409, 'unapproved execution refused');
  const ar = await post(`/api/plans/${body.plan.id}/approve`);
  assert.strictEqual(ar.status, 200);
  const xr = await post(`/api/plans/${body.plan.id}/execute`);
  assert.strictEqual(xr.status, 200);
  assert.match(git(['status', '--porcelain=v1']), /^A\s+scratch-note\.md/m);
});

test('founder class: git-push approval requires typed confirmation', async () => {
  const ir = await post('/api/intents', { kind: 'git-push', payload: {} });
  const { intent } = await ir.json();
  const pr = await post(`/api/intents/${intent.id}/plan`);
  const { plan } = await pr.json();
  assert.strictEqual(plan.class, 'founder');
  const noConfirm = await post(`/api/plans/${plan.id}/approve`);
  assert.strictEqual(noConfirm.status, 403);
  assert.strictEqual((await noConfirm.json()).code, 'confirm-required');
  const wrong = await post(`/api/plans/${plan.id}/approve`, { confirm: 'yes' });
  assert.strictEqual(wrong.status, 403);
  const right = await post(`/api/plans/${plan.id}/approve`, { confirm: plan.id });
  assert.strictEqual(right.status, 200);
});

test('rollback: founder confirmation, preimage restore, divergence refusal', async () => {
  const tr = await post('/api/work/tasks/transition', { taskId: 'ship-cockpit:T4', to: 'active' });
  const { execution } = await tr.json();
  assert.strictEqual(execution.status, 'succeeded');
  const goalPath = path.join(PROJ, 'os/goals/ship-cockpit.md');
  const afterWrite = fs.readFileSync(goalPath, 'utf8');
  // No confirmation → refused.
  const noConfirm = await post(`/api/executions/${execution.id}/rollback`);
  assert.strictEqual(noConfirm.status, 403);
  // Confirmed → preimage restored.
  const ok = await post(`/api/executions/${execution.id}/rollback`, { confirm: execution.id });
  assert.strictEqual(ok.status, 200);
  const restored = fs.readFileSync(goalPath, 'utf8');
  assert.match(restored, /\| T4 \| Approval dialog \| planned \|/);
  assert.notStrictEqual(restored, afterWrite);
  // Second rollback → state error.
  const again = await post(`/api/executions/${execution.id}/rollback`, { confirm: execution.id });
  assert.strictEqual(again.status, 409);
  // Divergence: execute, externally edit, rollback refused.
  const tr2 = await post('/api/work/tasks/transition', { taskId: 'ship-cockpit:T4', to: 'active' });
  const exe2 = (await tr2.json()).execution;
  fs.writeFileSync(goalPath, fs.readFileSync(goalPath, 'utf8') + '\n<!-- diverged -->\n', 'utf8');
  const refused = await post(`/api/executions/${exe2.id}/rollback`, { confirm: exe2.id });
  assert.strictEqual(refused.status, 409);
  assert.strictEqual((await refused.json()).code, 'diverged');
});

test('halt: completed executions cannot be halted', async () => {
  const lifecycle = await (await fetch(base + '/api/lifecycle')).json();
  const done = lifecycle.executions.find((e) => e.status === 'succeeded');
  assert.ok(done);
  const res = await post(`/api/executions/${done.id}/halt`);
  assert.strictEqual(res.status, 409);
});

test('transport: non-JSON bodies and denied methods are refused', async () => {
  const badCt = await fetch(base + '/api/intents', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', 'X-Dreamfeed-Token': token, Origin: base },
    body: 'kind=evil',
  });
  assert.strictEqual(badCt.status, 415);
  const del = await fetch(base + '/api/intents', { method: 'DELETE', headers: { 'X-Dreamfeed-Token': token } });
  assert.strictEqual(del.status, 405);
});

test('validation: bad target status and unknown task are 400/404', async () => {
  const bad = await post('/api/work/tasks/transition', { taskId: 'ship-cockpit:T1', to: 'obliterated' });
  assert.strictEqual(bad.status, 400);
  const missing = await post('/api/work/tasks/transition', { taskId: 'nope:X9', to: 'done' });
  assert.strictEqual(missing.status, 404);
});
