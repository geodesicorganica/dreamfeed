'use strict';
// Full-pipeline tests over the checked-in generic governance fixture
// (test/fixtures/generic-governance/). Mirrors the Stakeport integration
// criteria — tiered fields, resolvable evidence, row↔object fidelity, approval
// queue — without needing DREAMFEED_STAKEPORT_ROOT, so this coverage runs in
// `npm test` and CI. The fixture also doubles as a demo project the cockpit
// can be pointed at.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { buildState } = require('../src/state');

const FIXTURE_ROOT = path.join(__dirname, 'fixtures', 'generic-governance');
const TIERS = ['Canonical', 'Derived', 'Candidate'];

function state() { return buildState({ repoRoot: FIXTURE_ROOT }); }

test('fixture parses without governance errors (optional sources degrade, never throw)', () => {
  const s = state();
  // The fixture deliberately omits the optional staleness guide and root
  // CLAUDE.md — a legitimate real-world governance repo shape. Their absence
  // must surface as graceful degradations, not parse failures elsewhere.
  const OPTIONAL = ['shared/cockpit-integration-guide.md', 'CLAUDE.md'];
  const unexpected = s.parseErrors.filter((e) => !OPTIONAL.includes(e.path));
  assert.deepStrictEqual(unexpected, [], 'governance files must parse cleanly');
});

test('fixture: every rendered field is tiered and every object carries resolvable evidence', () => {
  const s = state();
  const all = [...s.strategicInitiatives, ...s.workItems, ...s.approvals];
  assert.ok(all.length > 0, 'no objects rendered from fixture');
  for (const o of all) {
    for (const [k, v] of Object.entries(o)) {
      if (k === 'objectType') continue;
      assert.ok(v && TIERS.includes(v.tier), `untiered field ${k}`);
      assert.ok(typeof v.nys === 'boolean', `field ${k} missing degradation flag`);
    }
    assert.strictEqual(o.source_evidence.nys, false, 'object missing source evidence');
    const abs = path.join(FIXTURE_ROOT, o.source_evidence.value.file);
    assert.ok(fs.existsSync(abs), `evidence does not resolve: ${o.source_evidence.value.file}`);
  }
});

test('fixture: every initiative and priority row renders exactly one object', () => {
  const s = state();
  assert.strictEqual(s.strategicInitiatives.length, 2, 'two initiatives expected');
  assert.strictEqual(s.workItems.length, 3, 'three work items expected');
  const siIds = s.strategicInitiatives.map((o) => o.id.value);
  assert.strictEqual(new Set(siIds).size, siIds.length, 'duplicate initiative ids');
  const ranks = s.workItems.map((o) => o.rank.value);
  assert.strictEqual(new Set(ranks).size, ranks.length, 'duplicate work-item ranks');
});

test('fixture: approval queue carries the open decision and conditional/pending gates, not resolved items', () => {
  const s = state();
  const queued = (kind) => s.approvalQueue.filter((a) => a.source_kind.value === kind);
  assert.deepStrictEqual(queued('decision').map((a) => a.id.value), ['D1'], 'only the open decision is queued');
  const gateStates = queued('dispatch-gate').map((a) => a.state.value).sort();
  assert.deepStrictEqual(gateStates, ['conditional', 'pending'], 'conditional and pending gates are queued');
});

test('fixture: work-item → initiative linking survives the pipeline', () => {
  const s = state();
  const linked = s.workItems.filter((w) => w.initiative_link && w.initiative_link.nys === false);
  assert.strictEqual(linked.length, 3, 'every work item links to its initiative');
});
