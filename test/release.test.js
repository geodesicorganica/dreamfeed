'use strict';
// D35 verification/release cockpit: sidecar records, governed lifecycle, guarded
// reads, and export envelopes. These records are local evidence, not source truth.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DREAMFEED_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'df-release-'));
process.env.DREAMFEED_NO_NATIVE = '1';

const STATE = process.env.DREAMFEED_STATE_DIR;
const REPO_A = fs.mkdtempSync(path.join(os.tmpdir(), 'df-rel-repo-a-'));
const REPO_B = fs.mkdtempSync(path.join(os.tmpdir(), 'df-rel-repo-b-'));
const REPO_HTTP = fs.mkdtempSync(path.join(os.tmpdir(), 'df-rel-http-'));

const store = require('../src/commands/store');
const { rootToken } = require('../src/parse');
const { loadPolicy } = require('../src/commands/policy');
const { readLedger } = require('../src/commands/ledger');
const {
  draftVerificationRecord,
  applyVerificationRecordCreate,
  draftReleaseCandidate,
  applyReleaseCandidateUpsert,
  applyReleaseState,
  listVerificationRecords,
  listReleaseCandidates,
  exportReleaseEvidence,
} = require('../src/release');

function verificationPayload(overrides = {}) {
  return {
    title: 'D35 verification snapshot',
    summary: 'Recorded current repo health and ledger evidence for release review.',
    checks: [{ label: 'npm test', status: 'pass', command: 'npm test', source: 'operator', ranAt: '2026-07-07T00:00:00.000Z' }],
    gitSnapshot: { branch: 'main', clean: true, counts: { staged: 0, unstaged: 0, untracked: 0 }, lastCommit: { hash: 'abc123' }, inspectedAt: '2026-07-07T00:00:00.000Z' },
    ledgerRange: { fromSeq: 1, toSeq: 1, chainHash: 'ledgerhash' },
    lifecycleRefs: ['pln_1', 'exe_1'],
    source: { type: 'repo-health', ref: 'test' },
    ...overrides,
  };
}

test('store: v2 sidecar migrates to v3 without losing lifecycle or memory records', () => {
  fs.writeFileSync(path.join(STATE, 'records.json'), JSON.stringify({
    schemaVersion: 2,
    counter: 9,
    intents: { int_1: { id: 'int_1', kind: 'memory-upsert' } },
    plans: { pln_1: { id: 'pln_1', status: 'planned' } },
    approvals: {},
    executions: {},
    memories: { mem_1: { id: 'mem_1', state: 'active' } },
  }), 'utf8');

  const snap = store.snapshot();
  const raw = JSON.parse(fs.readFileSync(path.join(STATE, 'records.json'), 'utf8'));
  assert.strictEqual(raw.schemaVersion, store.SCHEMA_VERSION);
  assert.deepStrictEqual(snap.intents.map((i) => i.id), ['int_1']);
  assert.deepStrictEqual(snap.plans.map((p) => p.id), ['pln_1']);
  assert.deepStrictEqual(snap.memories.map((m) => m.id), ['mem_1']);
  assert.deepStrictEqual(snap.verificationRecords, []);
  assert.deepStrictEqual(snap.releaseCandidates, []);
});

test('release: verification and release records validate, scope, derive currency, and export', () => {
  const secret = draftVerificationRecord({
    title: 'Bad',
    summary: 'token = sk-proj-secretsecretsecret',
    checks: [{ label: 'x', status: 'pass' }],
  }, { repoRoot: REPO_A });
  assert.strictEqual(secret.code, 'secret');

  const drafted = draftVerificationRecord(verificationPayload(), { repoRoot: REPO_A });
  assert.ok(!drafted.error, drafted.error);
  const saved = applyVerificationRecordCreate({ draft: drafted.record, actor: 'operator' }, REPO_A).record;
  assert.strictEqual(saved.scope.rootToken, rootToken(REPO_A));
  assert.match(saved.contentHash, /^[a-f0-9]{64}$/);

  const current = listVerificationRecords({
    repoRoot: REPO_A,
    repoHealth: { clean: true, counts: { staged: 0, unstaged: 0, untracked: 0 }, lastCommit: { hash: 'abc123' } },
    ledgerChain: { ok: true, length: 1 },
  });
  assert.strictEqual(current[0].currency, 'current');
  const stale = listVerificationRecords({
    repoRoot: REPO_A,
    repoHealth: { clean: false, counts: { staged: 0, unstaged: 1, untracked: 0 }, lastCommit: { hash: 'abc123' } },
    ledgerChain: { ok: true, length: 2 },
  });
  assert.strictEqual(stale[0].currency, 'stale');
  assert.deepStrictEqual(listVerificationRecords({ repoRoot: REPO_B }), []);

  const releaseDraft = draftReleaseCandidate({
    title: 'D35 release candidate',
    versionLabel: 'd35-test',
    summary: 'Verification and release cockpit evidence.',
    verificationRecordIds: [saved.id],
    gitSnapshot: verificationPayload().gitSnapshot,
    ledgerRange: verificationPayload().ledgerRange,
  }, { repoRoot: REPO_A });
  assert.ok(!releaseDraft.error, releaseDraft.error);
  const release = applyReleaseCandidateUpsert({ draft: releaseDraft.release, actor: 'operator' }, REPO_A).release;
  assert.strictEqual(release.state, 'candidate');
  assert.strictEqual(listReleaseCandidates({ repoRoot: REPO_A })[0].id, release.id);

  const ready = applyReleaseState({ releaseId: release.id, state: 'ready', actor: 'operator' }, REPO_A).release;
  assert.strictEqual(ready.state, 'ready');
  const shipped = applyReleaseState({ releaseId: release.id, state: 'shipped', actor: 'operator' }, REPO_A).release;
  assert.strictEqual(shipped.state, 'shipped');
  assert.ok(shipped.shippedAt);

  const exported = exportReleaseEvidence({ repoRoot: REPO_A, repoHealth: { clean: true, counts: { staged: 0, unstaged: 0, untracked: 0 }, lastCommit: { hash: 'abc123' } }, ledgerChain: { ok: true, length: 1 } });
  assert.strictEqual(exported.schemaVersion, store.SCHEMA_VERSION);
  assert.strictEqual(exported.exportVersion, 1);
  assert.strictEqual(exported.project.rootToken, rootToken(REPO_A));
  assert.strictEqual(exported.counts.verificationRecords, 1);
  assert.strictEqual(exported.counts.shipped, 1);
});

test('lifecycle/http: D35 records use governed plans, guarded GETs, and ledger-safe event bodies', async () => {
  const server = require('../src/server');
  server._setCurrentRoot(REPO_HTTP);
  await new Promise((resolve) => server.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.server.address().port}`;
  const token = (await (await fetch(base + '/api/project')).json()).actionToken;
  const get = (route) => fetch(base + route, { headers: { 'X-Dreamfeed-Token': token, Origin: base } });
  const post = (route, body = {}) => fetch(base + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Dreamfeed-Token': token, Origin: base },
    body: JSON.stringify(body),
  });

  try {
    assert.strictEqual((await fetch(base + '/api/releases', { method: 'POST' })).status, 405);
    assert.strictEqual((await fetch(base + '/api/verification')).status, 403);
    assert.strictEqual((await fetch(base + '/api/releases/export')).status, 403);

    fs.mkdirSync(path.join(REPO_HTTP, 'os'), { recursive: true });
    fs.writeFileSync(path.join(REPO_HTTP, 'os', 'policy.md'), [
      '| Operation | Class |',
      '|---|---|',
      '| verification-record-create | auto |',
      '| release-candidate-upsert | auto |',
      '| release-mark-ready | auto |',
      '| release-abandon | auto |',
      '| release-mark-shipped | auto |',
      '',
    ].join('\n'), 'utf8');
    const policy = loadPolicy(REPO_HTTP);
    assert.strictEqual(policy.classes['verification-record-create'], 'approve');
    assert.strictEqual(policy.classes['release-candidate-upsert'], 'approve');
    assert.strictEqual(policy.classes['release-mark-ready'], 'approve');
    assert.strictEqual(policy.classes['release-abandon'], 'approve');
    assert.strictEqual(policy.classes['release-mark-shipped'], 'founder');

    const verificationIntent = await (await post('/api/intents', { kind: 'verification-record-create', payload: verificationPayload({ summary: 'D35 lifecycle HTTP verification body must not be in the ledger.' }) })).json();
    const verificationPlan = await (await post(`/api/intents/${verificationIntent.intent.id}/plan`)).json();
    assert.strictEqual(verificationPlan.plan.class, 'approve');
    assert.strictEqual((await post(`/api/plans/${verificationPlan.plan.id}/approve`)).status, 200);
    const verificationExec = await (await post(`/api/plans/${verificationPlan.plan.id}/execute`)).json();
    const verId = verificationExec.execution.results[0].verificationRecord.id;

    const releaseIntent = await (await post('/api/intents', {
      kind: 'release-candidate-upsert',
      payload: {
        title: 'D35 HTTP release',
        versionLabel: 'd35-http',
        summary: 'Release body must not be copied into ledger events.',
        verificationRecordIds: [verId],
        gitSnapshot: verificationPayload().gitSnapshot,
        ledgerRange: verificationPayload().ledgerRange,
      },
    })).json();
    const releasePlan = await (await post(`/api/intents/${releaseIntent.intent.id}/plan`)).json();
    assert.strictEqual(releasePlan.plan.class, 'approve');
    await post(`/api/plans/${releasePlan.plan.id}/approve`);
    const releaseExec = await (await post(`/api/plans/${releasePlan.plan.id}/execute`)).json();
    const relId = releaseExec.execution.results[0].releaseCandidate.id;

    const readyPlan = await (await (async () => {
      const intent = await (await post('/api/intents', { kind: 'release-mark-ready', payload: { releaseId: relId } })).json();
      return post(`/api/intents/${intent.intent.id}/plan`);
    })()).json();
    assert.strictEqual(readyPlan.plan.class, 'approve');
    await post(`/api/plans/${readyPlan.plan.id}/approve`);
    await post(`/api/plans/${readyPlan.plan.id}/execute`);

    const shipIntent = await (await post('/api/intents', { kind: 'release-mark-shipped', payload: { releaseId: relId } })).json();
    const shipPlan = await (await post(`/api/intents/${shipIntent.intent.id}/plan`)).json();
    assert.strictEqual(shipPlan.plan.class, 'founder');
    assert.strictEqual((await post(`/api/plans/${shipPlan.plan.id}/approve`)).status, 403);
    assert.strictEqual((await post(`/api/plans/${shipPlan.plan.id}/approve`, { confirm: shipPlan.plan.id })).status, 200);
    const shipped = await (await post(`/api/plans/${shipPlan.plan.id}/execute`)).json();
    assert.strictEqual(shipped.execution.results[0].releaseCandidate.state, 'shipped');

    const releases = await (await get('/api/releases')).json();
    assert.ok(releases.verificationRecords.some((r) => r.id === verId));
    assert.ok(releases.releaseCandidates.some((r) => r.id === relId));
    const exported = await (await get('/api/releases/export')).json();
    assert.strictEqual(exported.exportVersion, 1);
    assert.ok(exported.releaseCandidates.some((r) => r.id === relId));

    const ledgerText = JSON.stringify(readLedger({ after: 0 }));
    assert.ok(!ledgerText.includes('D35 lifecycle HTTP verification body'), 'ledger must not contain verification summary text');
    assert.ok(!ledgerText.includes('Release body must not be copied'), 'ledger must not contain release summary text');
  } finally {
    await new Promise((resolve) => server.server.close(resolve));
    server._resetForTest();
  }
});
