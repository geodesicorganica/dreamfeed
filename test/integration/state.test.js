'use strict';
// Integration tests over the live Stakeport governance files (read-only).
// Requires DREAMFEED_STAKEPORT_ROOT to be set.
const STAKEPORT_ROOT = process.env.DREAMFEED_STAKEPORT_ROOT;
if (!STAKEPORT_ROOT) { process.exit(0); }

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { buildState } = require('../../src/state');
const { findTable, parseFile } = require('../../src/parse');

const TIERS = ['Canonical', 'Derived', 'Candidate'];

function everyField(obj, fn) {
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'objectType') continue;
    fn(k, v);
  }
}

test('criterion (a)+(b): every rendered field tiered; every object carries resolvable source evidence', () => {
  const state = buildState({ repoRoot: STAKEPORT_ROOT });
  const all = [...state.strategicInitiatives, ...state.workItems, ...state.approvals];
  assert.ok(all.length > 0, 'no objects rendered');
  for (const o of all) {
    everyField(o, (k, v) => {
      assert.ok(v && TIERS.includes(v.tier), `untiered field ${k}`);
      assert.ok(typeof v.nys === 'boolean', `field ${k} missing degradation flag`);
    });
    assert.strictEqual(o.source_evidence.nys, false, 'object missing source evidence');
    const abs = path.join(STAKEPORT_ROOT, o.source_evidence.value.file);
    assert.ok(fs.existsSync(abs), `source evidence does not resolve: ${o.source_evidence.value.file}`);
  }
});

test('criterion (c): every strategic_initiatives and weekly_priorities row renders exactly one object', () => {
  const state = buildState({ repoRoot: STAKEPORT_ROOT });
  const siContent = fs.readFileSync(path.join(STAKEPORT_ROOT, 'agents/founder/outputs/strategic_initiatives.md'), 'utf8');
  const siTable = findTable(siContent, ['Initiative', 'Stage', 'Status', 'Owner', 'Success Definition']);
  assert.strictEqual(state.strategicInitiatives.length, siTable.rows.length, 'SI row/object mismatch');
  const siIds = state.strategicInitiatives.map(o => o.id.value);
  assert.strictEqual(new Set(siIds).size, siIds.length, 'duplicate SI objects');

  const wpContent = fs.readFileSync(path.join(STAKEPORT_ROOT, 'agents/founder/outputs/weekly_priorities.md'), 'utf8');
  const wpTable = findTable(wpContent, ['Rank', 'Action', 'Owner', 'Initiative', 'Est', 'Status']);
  assert.strictEqual(state.workItems.length, wpTable.rows.length, 'WI row/object mismatch');
  const ranks = state.workItems.map(o => o.rank.value);
  assert.strictEqual(new Set(ranks).size, ranks.length, 'duplicate WI objects');
});

test('criterion (d): Approval Queue carries every open decision row and every conditional/pending gate', () => {
  const state = buildState({ repoRoot: STAKEPORT_ROOT });
  const dqContent = fs.readFileSync(path.join(STAKEPORT_ROOT, 'agents/founder/outputs/decision_queue.md'), 'utf8');
  const dqTable = findTable(dqContent, ['Decision', 'Consequence', 'Decision maker', 'Information needed']);
  const openRows = dqTable.rows.filter(r => !/^\*\*\[RESOLVED/.test(r.cells[1]));
  const queuedDecisionIds = state.approvalQueue.filter(a => a.source_kind.value === 'decision').map(a => a.id.value);
  for (const r of openRows) {
    assert.ok(queuedDecisionIds.includes(r.cells[0]), `open decision ${r.cells[0]} missing from queue`);
  }
  assert.strictEqual(queuedDecisionIds.length, openRows.length, 'queue decision count mismatch');
  const gateStates = state.approvalQueue.filter(a => a.source_kind.value === 'dispatch-gate').map(a => a.state.value);
  assert.ok(gateStates.every(s => s === 'conditional' || s === 'pending'), 'non-gated dispatch in queue');
  assert.strictEqual(gateStates.length, state.counts.conditionalGates + state.counts.pendingGates);
});

test('criterion (e): every loaded source classifies into exactly one schema family', () => {
  const state = buildState({ repoRoot: STAKEPORT_ROOT });
  for (const s of state.sources) {
    assert.ok(['governance', 'content', 'untyped'].includes(s.schemaFamily), `${s.path} unclassified`);
  }
  assert.ok(state.sources.every(s => s.schemaFamily === 'governance'), 'a five-file source misclassified');
});

test('criterion (f): every object carries a freshness field derived against guide §3', () => {
  const state = buildState({ repoRoot: STAKEPORT_ROOT });
  assert.strictEqual(state.thresholdsSource, 'shared/cockpit-integration-guide.md §3');
  const all = [...state.strategicInitiatives, ...state.workItems, ...state.approvals];
  for (const o of all) {
    assert.ok(o.freshness, 'missing freshness');
    if (!o.freshness.nys) {
      assert.ok(['fresh', 'amber', 'stale'].includes(o.freshness.value.state));
      assert.ok(o.freshness.value.thresholdDays > 0);
    }
  }
});

test('criterion (g): building state writes zero bytes to any source file', () => {
  const targets = [
    'agents/founder/outputs/strategic_initiatives.md',
    'agents/founder/outputs/weekly_priorities.md',
    'agents/founder/outputs/decision_queue.md',
    'agents/founder/outputs/agent_dispatch.md',
    'agents/founder/outputs/blocked_items.md',
    'shared/cockpit-integration-guide.md',
  ];
  const before = targets.map(t => fs.statSync(path.join(STAKEPORT_ROOT, t)).mtimeMs);
  buildState({ repoRoot: STAKEPORT_ROOT });
  buildState({ repoRoot: STAKEPORT_ROOT });
  const after = targets.map(t => fs.statSync(path.join(STAKEPORT_ROOT, t)).mtimeMs);
  assert.deepStrictEqual(after, before, 'source file mtime changed during state build');
});

test('blocked_items renders no object in Brief A (loaded for visibility only)', () => {
  const state = buildState({ repoRoot: STAKEPORT_ROOT });
  const blocked = state.sources.find(s => s.key === 'blocked_items');
  assert.ok(blocked);
  assert.strictEqual(blocked.rendersObjects, false);
  const all = [...state.strategicInitiatives, ...state.workItems, ...state.approvals];
  assert.ok(all.every(o => !o.source_evidence.value.file.includes('blocked_items')),
    'an object rendered from blocked_items.md');
});

test('parse-error state: a missing file degrades to an error entry, never a crash', () => {
  const f = parseFile(path.join(STAKEPORT_ROOT, 'agents/founder/outputs/does_not_exist.md'));
  assert.ok(f.error, 'missing file should yield an error entry');
  assert.strictEqual(f.content, null);
});
