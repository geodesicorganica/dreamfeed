'use strict';
// Governed memory layer (D33): sidecar migration, validation, scoped retrieval,
// and tombstone deletion. These tests exercise the module API used by the
// lifecycle and HTTP layers rather than private helpers.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

process.env.DREAMFEED_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'df-memory-'));

const STATE = process.env.DREAMFEED_STATE_DIR;
const REPO_A = fs.mkdtempSync(path.join(os.tmpdir(), 'df-mem-repo-a-'));
const REPO_B = fs.mkdtempSync(path.join(os.tmpdir(), 'df-mem-repo-b-'));
const REPO_C = fs.mkdtempSync(path.join(os.tmpdir(), 'df-mem-repo-c-'));

const store = require('../src/commands/store');
const { rootToken } = require('../src/parse');
const {
  draftMemory,
  applyMemoryUpsert,
  applyMemoryDelete,
  applyMemoryArchive,
  retrieveMemories,
  exportMemories,
} = require('../src/memory');
const { readLedger } = require('../src/commands/ledger');

test('store: v1 sidecar migrates to v3 without losing lifecycle records', () => {
  fs.writeFileSync(path.join(STATE, 'records.json'), JSON.stringify({
    schemaVersion: 1,
    counter: 7,
    intents: { int_1: { id: 'int_1', kind: 'task-transition' } },
    plans: { pln_1: { id: 'pln_1', status: 'planned' } },
    approvals: {},
    executions: {},
  }), 'utf8');

  const snap = store.snapshot();
  const raw = JSON.parse(fs.readFileSync(path.join(STATE, 'records.json'), 'utf8'));
  assert.strictEqual(raw.schemaVersion, store.SCHEMA_VERSION);
  assert.deepStrictEqual(snap.intents.map((i) => i.id), ['int_1']);
  assert.deepStrictEqual(snap.plans.map((p) => p.id), ['pln_1']);
  assert.deepStrictEqual(snap.memories, []);
  assert.deepStrictEqual(snap.verificationRecords, []);
  assert.deepStrictEqual(snap.releaseCandidates, []);
});

test('store: unsupported future sidecars are not overwritten with empty state', () => {
  const file = path.join(STATE, 'records.json');
  const future = {
    schemaVersion: 999,
    counter: 42,
    intents: { int_future: { id: 'int_future', kind: 'future-kind' } },
    plans: {},
    approvals: {},
    executions: {},
    memories: {},
    verificationRecords: {},
    releaseCandidates: {},
  };
  const before = JSON.stringify(future, null, 1);
  fs.writeFileSync(file, before, 'utf8');

  try {
    assert.throws(() => store.snapshot(), /unsupported records schemaVersion: 999/);
    assert.strictEqual(fs.readFileSync(file, 'utf8'), before);
  } finally {
    fs.writeFileSync(file, JSON.stringify({
      schemaVersion: store.SCHEMA_VERSION,
      counter: 0,
      intents: {},
      plans: {},
      approvals: {},
      executions: {},
      memories: {},
      verificationRecords: {},
      releaseCandidates: {},
    }), 'utf8');
  }
});

test('memory: approveable project memory validates, stores, retrieves, and exports', () => {
  const draft = draftMemory({
    kind: 'semantic',
    title: 'Queue review cadence',
    body: 'Review blocked tasks before planning new work.',
    tags: ['queue', 'review'],
    source: { type: 'manual', ref: 'operator note' },
    confidence: 'high',
  }, { repoRoot: REPO_A });
  assert.ok(!draft.error, draft.error);

  const saved = applyMemoryUpsert({ draft: draft.memory, actor: 'operator' }, REPO_A);
  assert.ok(!saved.error, saved.error);
  assert.strictEqual(saved.memory.state, 'active');
  assert.strictEqual(saved.memory.scope.type, 'project');
  assert.strictEqual(saved.memory.scope.rootToken, rootToken(REPO_A));
  assert.match(saved.memory.contentHash, /^[a-f0-9]{64}$/);

  const hit = retrieveMemories({ repoRoot: REPO_A, query: 'blocked queue', limit: 3 });
  assert.deepStrictEqual(hit.used.map((m) => m.id), [saved.memory.id]);
  assert.match(hit.context, /Queue review cadence/);

  const other = retrieveMemories({ repoRoot: REPO_B, query: 'blocked queue', limit: 3 });
  assert.deepStrictEqual(other.used, []);

  const exported = exportMemories({ repoRoot: REPO_A });
  assert.strictEqual(exported.exportVersion, 1);
  assert.strictEqual(exported.schemaVersion, store.SCHEMA_VERSION);
  assert.strictEqual(exported.project.rootToken, rootToken(REPO_A));
  assert.strictEqual(exported.counts.active, 1);
  assert.deepStrictEqual(exported.memories.map((m) => m.id), [saved.memory.id]);
});

test('memory: retrieval metadata, filters, export envelope, and caps are deterministic read-derived data', () => {
  const first = applyMemoryUpsert({ draft: draftMemory({
    kind: 'semantic',
    title: 'Memory retrieval cadence',
    body: 'Use retrieval reasons when explaining why a memory was selected.',
    tags: ['retrieval', 'trust'],
    source: { type: 'ledger', ref: '#7' },
    confidence: 'high',
  }, { repoRoot: REPO_C }).memory, actor: 'operator' }, REPO_C).memory;
  const second = applyMemoryUpsert({ draft: draftMemory({
    kind: 'preference',
    title: 'Operator preference',
    body: 'Prefer dense cockpit tables for inspection surfaces.',
    tags: ['ui', 'dense'],
    scope: { type: 'operator' },
  }, { repoRoot: REPO_C }).memory, actor: 'operator' }, REPO_C).memory;

  const before = JSON.stringify(store.get('memories', first.id));
  const hit = retrieveMemories({ repoRoot: REPO_C, query: 'retrieval trust', tag: 'trust', limit: 10 });
  assert.deepStrictEqual(hit.used.map((m) => m.id), [first.id]);
  assert.ok(hit.items[0].retrieval.score > 0);
  assert.ok(hit.items[0].retrieval.matchedFields.includes('tags'));
  assert.ok(hit.items[0].retrieval.reasons.some((r) => r.startsWith('tag:')));
  assert.strictEqual(JSON.stringify(store.get('memories', first.id)), before, 'retrieval must not mutate memory records');

  const operatorScoped = retrieveMemories({ repoRoot: REPO_C, query: 'tables', scope: 'operator', limit: 10 });
  assert.deepStrictEqual(operatorScoped.used.map((m) => m.id), [second.id]);

  const capped = retrieveMemories({ repoRoot: REPO_C, query: 'retrieval', limit: 6, capChars: 24 });
  assert.strictEqual(capped.contextMeta.capChars, 24);
  assert.strictEqual(capped.contextMeta.truncated, true);
  assert.match(capped.context, /memory context truncated by D34 cap/);

  const archived = applyMemoryArchive({ memoryId: second.id, actor: 'operator' }, REPO_C).memory;
  const deleted = applyMemoryDelete({ memoryId: archived.id, actor: 'operator' }, REPO_C).memory;
  const exported = exportMemories({ repoRoot: REPO_C, includeArchived: true, includeDeleted: true });
  assert.strictEqual(exported.exportVersion, 1);
  assert.strictEqual(exported.schemaVersion, store.SCHEMA_VERSION);
  assert.strictEqual(exported.project.rootToken, rootToken(REPO_C));
  assert.ok(exported.generatedAt);
  assert.strictEqual(exported.counts.deletedTombstone, 1);
  const tombstone = exported.memories.find((m) => m.id === deleted.id);
  assert.strictEqual(tombstone.state, 'deleted-tombstone');
  assert.strictEqual(tombstone.body, '');
  assert.strictEqual(tombstone.title, '');
  assert.match(tombstone.contentHash, /^[a-f0-9]{64}$/);
});

test('memory: likely secrets are rejected before persistence', () => {
  const draft = draftMemory({
    kind: 'preference',
    title: 'Provider token',
    body: 'Use OPENAI_API_KEY=sk-proj-secret-value in the assistant.',
  }, { repoRoot: REPO_A });
  assert.strictEqual(draft.code, 'secret');
  assert.match(draft.error, /secret/i);
});

test('memory: founder delete clears content and leaves an audit tombstone', () => {
  const draft = draftMemory({
    kind: 'procedural',
    title: 'Approval reminder',
    body: 'Never self-accept founder gates.',
  }, { repoRoot: REPO_A });
  const saved = applyMemoryUpsert({ draft: draft.memory, actor: 'operator' }, REPO_A).memory;
  const deleted = applyMemoryDelete({ memoryId: saved.id, actor: 'operator' }, REPO_A);
  assert.ok(!deleted.error, deleted.error);
  assert.strictEqual(deleted.memory.state, 'deleted-tombstone');
  assert.strictEqual(deleted.memory.title, '');
  assert.strictEqual(deleted.memory.body, '');
  assert.deepStrictEqual(deleted.memory.tags, []);
  assert.strictEqual(deleted.memory.contentHash, saved.contentHash);
  const reactivated = applyMemoryUpsert({
    memoryId: saved.id,
    draft: { kind: 'procedural', title: 'Restored reminder', body: 'This should not reactivate a tombstone.' },
    actor: 'operator',
  }, REPO_A);
  assert.strictEqual(reactivated.code, 'state');
  assert.deepStrictEqual(retrieveMemories({ repoRoot: REPO_A, query: 'Approval reminder' }).used, []);
});

test('lifecycle: memory upsert, archive, and delete use governed plans', async () => {
  const server = require('../src/server');
  server._setCurrentRoot(REPO_A);
  await new Promise((resolve) => server.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.server.address().port}`;
  const token = (await (await fetch(base + '/api/project')).json()).actionToken;
  const post = (route, body = {}) => fetch(base + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Dreamfeed-Token': token, Origin: base },
    body: JSON.stringify(body),
  });

  try {
    const upsertIntent = await (await post('/api/intents', {
      kind: 'memory-upsert',
      payload: {
        kind: 'semantic',
        title: 'Governed memory',
        body: 'Memory writes require explicit approval.',
        tags: ['memory'],
      },
    })).json();
    const planned = await (await post(`/api/intents/${upsertIntent.intent.id}/plan`)).json();
    assert.strictEqual(planned.plan.class, 'approve');
    assert.strictEqual(planned.approval, undefined);
    assert.strictEqual((await post(`/api/plans/${planned.plan.id}/execute`)).status, 409);
    assert.strictEqual((await post(`/api/plans/${planned.plan.id}/approve`)).status, 200);
    const executed = await (await post(`/api/plans/${planned.plan.id}/execute`)).json();
    assert.strictEqual(executed.execution.status, 'succeeded');
    const memId = executed.execution.results[0].memory.id;

    fs.mkdirSync(path.join(REPO_A, 'os'), { recursive: true });
    fs.writeFileSync(path.join(REPO_A, 'os', 'policy.md'), [
      '| Operation | Class |',
      '|---|---|',
      '| memory-upsert | auto |',
      '| memory-archive | auto |',
      '| memory-delete | auto |',
      '',
    ].join('\n'), 'utf8');

    const weakenedUpsertIntent = await (await post('/api/intents', {
      kind: 'memory-upsert',
      payload: { kind: 'semantic', title: 'Policy floor', body: 'Memory upsert cannot be auto-classed.' },
    })).json();
    const weakenedUpsertPlan = await (await post(`/api/intents/${weakenedUpsertIntent.intent.id}/plan`)).json();
    assert.strictEqual(weakenedUpsertPlan.plan.class, 'approve');

    const archiveIntent = await (await post('/api/intents', { kind: 'memory-archive', payload: { memoryId: memId } })).json();
    const archivePlan = await (await post(`/api/intents/${archiveIntent.intent.id}/plan`)).json();
    assert.strictEqual(archivePlan.plan.class, 'approve');
    await post(`/api/plans/${archivePlan.plan.id}/approve`);
    const archived = await (await post(`/api/plans/${archivePlan.plan.id}/execute`)).json();
    assert.strictEqual(archived.execution.results[0].memory.state, 'archived');

    const deleteIntent = await (await post('/api/intents', { kind: 'memory-delete', payload: { memoryId: memId } })).json();
    const deletePlan = await (await post(`/api/intents/${deleteIntent.intent.id}/plan`)).json();
    assert.strictEqual(deletePlan.plan.class, 'founder');
    const noConfirm = await post(`/api/plans/${deletePlan.plan.id}/approve`);
    assert.strictEqual(noConfirm.status, 403);
    assert.strictEqual((await post(`/api/plans/${deletePlan.plan.id}/approve`, { confirm: deletePlan.plan.id })).status, 200);
    const deleted = await (await post(`/api/plans/${deletePlan.plan.id}/execute`)).json();
    assert.strictEqual(deleted.execution.results[0].memory.state, 'deleted-tombstone');
    assert.strictEqual(deleted.execution.results[0].memory.body, undefined, 'execution result exposes summary, not body content');

    const ledgerText = JSON.stringify(readLedger({ after: 0 }));
    assert.ok(!ledgerText.includes('Memory writes require explicit approval.'), 'ledger must not contain memory body content');
  } finally {
    await new Promise((resolve) => server.server.close(resolve));
    server._resetForTest();
  }
});

test('http/assistant: memory is GET-only, exportable, and injected visibly into assistant context', async () => {
  const server = require('../src/server');
  server._setCurrentRoot(REPO_A);
  const cfgPath = path.join(__dirname, '..', 'assistant-config.json');
  const hadConfig = fs.existsSync(cfgPath);
  const priorConfig = hadConfig ? fs.readFileSync(cfgPath, 'utf8') : null;
  const mockAssistant = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: raw.includes('Dreamfeed memory context') ? 'MEMORY_OK' : 'NO_MEMORY' } }] }));
    });
  });
  await new Promise((resolve) => mockAssistant.listen(0, '127.0.0.1', resolve));
  fs.writeFileSync(cfgPath, JSON.stringify({
    provider: 'http',
    http: { url: `http://127.0.0.1:${mockAssistant.address().port}/chat`, model: 'test' },
  }), 'utf8');

  const draft = draftMemory({
    kind: 'semantic',
    title: 'Assistant retrieval rule',
    body: 'Mention governed memories only as non-authoritative context.',
    tags: ['assistant', 'retrieval'],
  }, { repoRoot: REPO_A }).memory;
  const saved = applyMemoryUpsert({ draft, actor: 'operator' }, REPO_A).memory;
  applyMemoryArchive({ memoryId: saved.id, actor: 'operator' }, REPO_A);
  const active = applyMemoryUpsert({ draft: { ...draft, title: 'Assistant context rule' }, actor: 'operator' }, REPO_A).memory;

  await new Promise((resolve) => server.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.server.address().port}`;
  const token = (await (await fetch(base + '/api/project')).json()).actionToken;
  const get = (route) => fetch(base + route, {
    headers: { 'X-Dreamfeed-Token': token, Origin: base },
  });
  const post = (route, body = {}) => fetch(base + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Dreamfeed-Token': token, Origin: base },
    body: JSON.stringify(body),
  });

  try {
    assert.strictEqual((await fetch(base + '/api/memory', { method: 'POST' })).status, 405);
    assert.strictEqual((await fetch(base + '/api/memory?q=assistant')).status, 403);
    assert.strictEqual((await fetch(base + '/api/memory/export?includeDeleted=1')).status, 403);
    const list = await (await get('/api/memory?q=assistant&includeReasons=1&limit=50')).json();
    assert.ok(list.memories.some((m) => m.id === active.id), 'active project memory is listed');
    assert.ok(!list.memories.some((m) => m.id === saved.id), 'archived memory is hidden unless requested');
    const activeListItem = list.memories.find((m) => m.id === active.id);
    assert.ok(activeListItem.retrieval.score > 0, 'read API exposes retrieval scores when requested');
    assert.ok(activeListItem.retrieval.reasons.length, 'read API exposes retrieval reasons when requested');
    assert.strictEqual(list.retrieval.filters.state, 'active');
    const exported = await (await get('/api/memory/export?includeArchived=1')).json();
    assert.strictEqual(exported.exportVersion, 1);
    assert.strictEqual(exported.schemaVersion, store.SCHEMA_VERSION);
    assert.ok(exported.generatedAt);
    assert.ok(exported.counts.archived >= 1);
    assert.ok(exported.memories.some((m) => m.id === saved.id), 'export can include archived memory');

    const res = await post('/api/assistant/chat/messages', { message: 'assistant retrieval rule?', context: 'Queue: none' });
    const body = await res.json();
    assert.strictEqual(res.status, 200, body.error || `HTTP ${res.status}`);
    assert.strictEqual(body.reply, 'MEMORY_OK');
    assert.ok(body.memory.used.some((m) => m.id === active.id));
    assert.ok(body.memory.memoryIdsUsed.includes(active.id));
    assert.ok(body.memory.memoryContextVisible.includes(active.id));
    assert.strictEqual(body.memory.contextMeta.capChars, 4000);
    assert.strictEqual(body.memory.contextMeta.maxMemories, 6);
    assert.ok(body.memory.used[0].retrieval.reasons.length);
    assert.ok(body.memory.citations.some((m) => m.id === active.id));
    assert.ok(body.memory.contextWarnings.some((w) => /manual source/.test(w)));
    assert.match(body.memory.citationWarning, new RegExp(active.id));
    assert.match(body.memory.context, /Assistant context rule/);
  } finally {
    await new Promise((resolve) => server.server.close(resolve));
    await new Promise((resolve) => mockAssistant.close(resolve));
    server._resetForTest();
    if (hadConfig) fs.writeFileSync(cfgPath, priorConfig, 'utf8');
    else { try { fs.unlinkSync(cfgPath); } catch { /* ignore */ } }
  }
});
