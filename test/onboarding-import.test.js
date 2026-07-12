'use strict';
// D36 governed-import suite: brownfield drafts carry evidence, degrade safely,
// and the /api/onboarding descriptor serves tree + prefills for both the
// Stakeport-shaped fixture (rich drafts) and an empty dir (bare tree).
const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DREAMFEED_NO_NATIVE = '1';
process.env.DREAMFEED_NO_PROBE = '1';
if (!process.env.DREAMFEED_STATE_DIR) {
  process.env.DREAMFEED_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'df-state-'));
}

const server = require('../src/server');
const { buildImports } = require('../src/onboarding/importers');
const { generateFamily } = require('../src/onboarding/generate');
const { buildNativeState } = require('../src/nativeSchema');

const FIXTURE = path.join(__dirname, 'fixtures', 'generic-governance');
let base, token;

before(async () => {
  await new Promise((resolve) => server.server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.server.address().port}`;
  token = (await (await fetch(base + '/api/project')).json()).actionToken;
});
after(() => { server.server.close(); });

test('goal drafts come from strategic initiatives with linked work items as tasks', () => {
  const imp = buildImports(FIXTURE);
  assert.ok(imp.goals.length >= 1, 'fixture initiatives become goal drafts');
  const g = imp.goals.find((x) => x.title === 'Fixture Initiative One');
  assert.ok(g, 'active initiative drafted');
  assert.strictEqual(g.imported, true);
  assert.strictEqual(g.importedFrom, 'agents/founder/outputs/strategic_initiatives.md');
  assert.ok(g.matchedBy.includes('stakeport:strategic_initiatives'));
  assert.ok(g.tasks.length >= 1, 'linked work items ride along as tasks');
  assert.ok(g.tasks.every((t) => ['planned', 'active', 'done', 'blocked'].includes(t.status)), 'statuses map to the native vocabulary');
});

test('prefills seed the interview with evidence lines', () => {
  const imp = buildImports(FIXTURE);
  assert.ok(imp.prefills.answers['q-business-name']);
  assert.strictEqual(imp.prefills.answers['q-goal-title'], imp.goals[0].title);
  assert.ok(imp.prefills.evidence['q-goal-title'], 'every prefill discloses where it came from');
});

test('empty dir degrades to zero drafts, never throws', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'df-empty-'));
  const imp = buildImports(empty);
  assert.deepStrictEqual(imp.goals, []);
  assert.deepStrictEqual(imp.operations, []);
  assert.deepStrictEqual(imp.roadmapPhases, []);
});

test('imported drafts flow through generateFamily into parseable os/ files', () => {
  const imp = buildImports(FIXTURE);
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'df-import-gen-'));
  const out = generateFamily('os-core', {
    repoRoot: stage,
    answers: { 'q-operator-name': 'Founder' },
    imports: { goals: imp.goals, operations: imp.operations },
    families: ['os-core'],
    asOfDate: '2026-07-07',
  });
  assert.ok(out.files.some((f) => f.path.startsWith('os/goals/')), 'imported goals become goal files');
  for (const f of out.files) {
    const abs = path.join(stage, f.path);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, f.content, 'utf8');
  }
  const native = buildNativeState({ repoRoot: stage });
  assert.deepStrictEqual(native.parseErrors, [], 'imported scaffold parses clean');
  assert.ok(native.goals.length >= 1);
  const goal = native.goals.find((g) => g.title.value === 'Fixture Initiative One');
  assert.ok(goal, 'initiative title survives the round trip');
});

test('GET /api/onboarding: guarded, and serves the bare tree when no project is set', async () => {
  const unguarded = await fetch(base + '/api/onboarding');
  assert.strictEqual(unguarded.status, 403, 'discloses repo content — must be guarded');
  server._setCurrentRoot(null);
  const res = await fetch(base + '/api/onboarding', { headers: { 'X-Dreamfeed-Token': token } });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.configured, false);
  assert.ok(body.questions.length >= 10, 'tree ships even with no project (greenfield entry)');
  assert.ok(body.families.includes('os-core'));
});

test('GET /api/onboarding on the fixture: drafts + prefills + hasNativeSchema=false', async () => {
  server._setCurrentRoot(FIXTURE);
  try {
    const res = await fetch(base + '/api/onboarding', { headers: { 'X-Dreamfeed-Token': token } });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.configured, true);
    assert.strictEqual(body.hasNativeSchema, false, 'fixture has no os/ layout yet — the adoption case');
    assert.ok(body.imports.goals.length >= 1);
    assert.ok(body.prefills.answers['q-goal-title']);
    assert.ok(typeof body.discoverySummary.candidates === 'number');
  } finally {
    server._setCurrentRoot(null);
  }
});
