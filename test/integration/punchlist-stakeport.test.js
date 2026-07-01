'use strict';
// Stakeport-specific punchlist tests requiring live governance files and a running audit.
// Requires DREAMFEED_STAKEPORT_ROOT to be set.
const STAKEPORT_ROOT = process.env.DREAMFEED_STAKEPORT_ROOT;
if (!STAKEPORT_ROOT) { process.exit(0); }

const test = require('node:test');
const assert = require('node:assert');
const { readRepoFile } = require('../../src/server');
const { getRepoHealth } = require('../../src/repohealth');
const { buildState } = require('../../src/state');

test('B6 /api/file: reads an allowed repo file from Stakeport root', () => {
  const r = readRepoFile('CLAUDE.md', STAKEPORT_ROOT);
  assert.ok(!r.error, `unexpected error: ${r.error}`);
  assert.ok(typeof r.content === 'string' && r.content.length > 0);
  assert.strictEqual(r.path, 'CLAUDE.md');
});

test('B2/B3 Repo Health: audit + validation-status model present and read-only (Stakeport)', () => {
  const h = getRepoHealth(STAKEPORT_ROOT);
  assert.strictEqual(h.readOnly, true);
  assert.ok(h.audit, 'audit block present');
  assert.ok('everRun' in h.audit, 'audit.everRun present');
  assert.ok(Array.isArray(h.validationCommands) && h.validationCommands.length >= 3);
  for (const c of h.validationCommands) {
    assert.ok(c.command && c.label, 'command has label+command');
    assert.ok(['pass', 'fail', 'never-run', 'stale', 'unavailable'].includes(c.status), `clear status model, got ${c.status}`);
    assert.ok('ranAt' in c && 'source' in c && 'currency' in c, 'status carries timestamp/source/currency');
  }
});

test('B1 Topology: node-to-node edges resolve to real nodes; provenance present (Stakeport)', () => {
  const st = buildState({ repoRoot: STAKEPORT_ROOT });
  const ids = new Set(st.topology.nodes.map(n => n.id.value));
  let nodeToNode = 0;
  for (const e of st.topology.edges) {
    if (e.from && !e.from.nys && e.to && !e.to.nys && ids.has(e.from.value) && ids.has(e.to.value)) {
      nodeToNode++;
      assert.ok(e.tier && (e.tier.nys || ['Canonical', 'Derived'].includes(e.tier.value)), 'edge has provenance tier');
      assert.ok(e.source_evidence && !e.source_evidence.nys, 'node-to-node edge cites source');
    }
  }
  assert.ok(nodeToNode > 0, 'expected node-to-node graph edges (owns/depends-on/reports-to/etc.)');
});

test('5b-r2 Topology accuracy: lists carry ALL nodes + ALL edges, incl. file-target (Stakeport)', () => {
  const st = buildState({ repoRoot: STAKEPORT_ROOT });
  const t = st.topology;
  const ids = new Set(t.nodes.map(n => n.id.value));
  assert.strictEqual(t.nodes.length, t.repoInventory.length, 'one node per definition file');
  assert.ok(t.nodes.length >= 12, `expected >= 12 nodes, got ${t.nodes.length}`);
  assert.strictEqual(t.edges.length, st.counts.topologyEdges, 'edge count matches state counts');
  let fileTarget = 0;
  for (const e of t.edges) { const to = e.to && !e.to.nys ? e.to.value : null; if (to && !ids.has(to)) fileTarget++; }
  assert.ok(fileTarget > 0, 'expected file-target edges present in the data (listed, not drawn)');
  for (const e of t.edges) assert.ok(e.tier, 'every edge has a tier field');
});
