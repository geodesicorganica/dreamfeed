'use strict';
// Dreamfeed-native schema adapter + queue projection tests (D31) over the
// checked-in fixture test/fixtures/dreamfeed-native/. Mirrors the provenance
// discipline of the Gate C suite: every field tiered, evidence resolvable,
// projection preserves the parent chain.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { buildNativeState, hasNativeSchema, findTask } = require('../src/nativeSchema');
const { buildQueue, buildSprintMetrics } = require('../src/queue');

const FIXTURE_ROOT = path.join(__dirname, 'fixtures', 'dreamfeed-native');
// Local-noon (not UTC) so isoDay's local-calendar classification is stable
// regardless of the test runner's timezone.
const TODAY = new Date(2026, 6, 10, 12, 0, 0);
const TIERS = ['Canonical', 'Derived', 'Candidate'];

function native() { return buildNativeState({ repoRoot: FIXTURE_ROOT, today: TODAY }); }

test('native: fixture is detected and parses without errors', () => {
  assert.strictEqual(hasNativeSchema(FIXTURE_ROOT), true);
  const n = native();
  assert.deepStrictEqual(n.parseErrors, [], 'fixture must parse cleanly');
  assert.strictEqual(n.goals.length, 1);
  assert.strictEqual(n.operations.length, 1);
  assert.strictEqual(n.blockers.length, 1);
});

test('native: hierarchy is preserved — Goal→Phase→Milestone→Task and Operation→Workflow→Task', () => {
  const n = native();
  const goal = n.goals[0];
  assert.strictEqual(goal.id.value, 'ship-cockpit');
  assert.deepStrictEqual(goal.phases.map((p) => p.title.value), ['Foundation', 'Polish']);
  const foundation = goal.phases[0];
  assert.deepStrictEqual(foundation.milestones.map((m) => m.title.value), ['Governed writes', 'Approvals']);
  assert.strictEqual(foundation.milestones[0].tasks.length, 3);
  const op = n.operations[0];
  assert.deepStrictEqual(op.workflows.map((w) => w.title.value), ['Monday sweep']);
  assert.strictEqual(op.workflows[0].tasks.length, 2);
});

test('native: every field is tiered and every task carries resolvable evidence and its chain', () => {
  const n = native();
  const tasks = [];
  for (const g of n.goals) for (const p of g.phases) for (const m of p.milestones) tasks.push(...m.tasks);
  for (const o of n.operations) for (const w of o.workflows) tasks.push(...w.tasks);
  assert.strictEqual(tasks.length, 8);
  for (const t of tasks) {
    for (const [k, v] of Object.entries(t)) {
      if (k === 'objectType') continue;
      assert.ok(v && TIERS.includes(v.tier), `untiered field ${k}`);
      assert.ok(typeof v.nys === 'boolean', `field ${k} missing degradation flag`);
    }
    assert.ok(fs.existsSync(path.join(FIXTURE_ROOT, t.source_evidence.value.file)), 'evidence resolves');
    const chain = t.chain.value;
    assert.ok((chain.goal && chain.phase && chain.milestone) || (chain.operation && chain.workflow),
      'task chain preserves its full parent path');
  }
});

test('queue: projection sections and ordering (today=2026-07-10)', () => {
  const q = buildQueue({ repoRoot: FIXTURE_ROOT, today: TODAY });
  assert.strictEqual(q.hasNative, true);
  // Today: T1 (active, scheduled today), T2 (scheduled today), T6 (blocked,
  // scheduled today — sorted last). Done tasks never appear.
  assert.deepStrictEqual(q.sections.today.map((e) => e.task.id.value),
    ['ship-cockpit:T1', 'ship-cockpit:T2', 'ship-cockpit:T6']);
  assert.strictEqual(q.sections.today[2].queueState.value, 'blocked');
  // Rolled over: T3 (07-08), W1 (07-06) — T5 is done and excluded.
  assert.deepStrictEqual(q.sections.rolledOver.map((e) => e.task.id.value).sort(),
    ['ship-cockpit:T3', 'weekly-review:W1'].sort());
  assert.ok(q.sections.rolledOver.every((e) => e.rolledOver.value === true));
  // Upcoming (7-day horizon): T4 (07-12), W2 (07-13).
  assert.deepStrictEqual(q.sections.upcoming.map((e) => e.task.id.value).sort(),
    ['ship-cockpit:T4', 'weekly-review:W2'].sort());
  // Streams never flatten: each entry declares its stream type.
  for (const s of Object.values(q.sections)) {
    for (const e of s) assert.ok(['goal', 'operation'].includes(e.streamType));
  }
});

test('sprint metrics: counts, estimates, rollover, completion', () => {
  const m = buildSprintMetrics({ repoRoot: FIXTURE_ROOT, today: TODAY });
  assert.deepStrictEqual(m.counts, { planned: 5, active: 1, done: 1, blocked: 1, rolledOver: 2 });
  // Est: 4+2+1+2+1+1 (goal) + 0.5+1 (operation) = 12.5 total; remaining excludes done T5 (1h).
  assert.strictEqual(m.estTotal, 12.5);
  assert.strictEqual(m.estRemaining, 11.5);
  assert.strictEqual(m.completionPct, 13); // 1 of 8
});

test('findTask locates the exact source row for the write engine', () => {
  const hit = findTask(FIXTURE_ROOT, 'ship-cockpit:T2');
  assert.ok(hit);
  assert.strictEqual(hit.kind, 'goal');
  assert.strictEqual(hit.relPath, 'os/goals/ship-cockpit.md');
  assert.strictEqual(hit.cells[1], 'Wire drift detection');
  assert.strictEqual(hit.cells[2], 'planned');
  assert.strictEqual(findTask(FIXTURE_ROOT, 'nope:X1'), null);
});

test('degradation: missing os/ layout yields empty shapes, never errors', () => {
  const empty = buildNativeState({ repoRoot: path.join(__dirname, 'fixtures', 'generic-governance') });
  assert.strictEqual(empty.hasNative, false);
  assert.deepStrictEqual(empty.goals, []);
  const q = buildQueue({ repoRoot: path.join(__dirname, 'fixtures', 'generic-governance') });
  assert.strictEqual(q.hasNative, false);
  assert.deepStrictEqual(q.counts, { today: 0, rolledOver: 0, upcoming: 0 });
});

test('D36: roadmap reads goal Phase structure as the primary source', () => {
  const { buildRoadmap } = require('../src/topology');
  const out = buildRoadmap(FIXTURE_ROOT);
  assert.deepStrictEqual(out.errors, [], 'native roadmap has no CLAUDE.md complaints');
  const labels = out.objects.map((o) => o.phase_label.value);
  assert.deepStrictEqual(labels, ['Foundation', 'Polish'], 'phases come from os/goals, in order');
  assert.strictEqual(out.objects[0].phase_label.tier, 'Canonical', 'declared phase labels are Canonical');
  assert.match(out.objects[0].scope_summary.value, /Ship the Cockpit/, 'scope names the owning goal');
  assert.strictEqual(out.objects[0].source_evidence.value.file, 'os/goals/ship-cockpit.md');
});
