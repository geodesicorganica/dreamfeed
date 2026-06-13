'use strict';
// Punchlist-fix tests (Goal C/Brief B 5b revisions): /api/file allowlist (B6),
// repo-health audit + validation-status model (B2/B3), graph edge data (B1).
const test = require('node:test');
const assert = require('node:assert');
const { readRepoFile } = require('../src/server');
const { getRepoHealth } = require('../src/repohealth');
const { buildState } = require('../src/state');

test('B6 /api/file: reads an allowed repo file', () => {
  const r = readRepoFile('CLAUDE.md');
  assert.ok(!r.error, `unexpected error: ${r.error}`);
  assert.ok(typeof r.content === 'string' && r.content.length > 0);
  assert.strictEqual(r.path, 'CLAUDE.md');
});

test('B6 /api/file: rejects path traversal', () => {
  for (const p of ['../../../etc/passwd', '..\\..\\secret', 'agents/../../outside.md']) {
    const r = readRepoFile(p);
    assert.ok(r.error, `traversal not rejected for ${p}`);
  }
});

test('B6 /api/file: rejects .git, node_modules, and non-text extensions', () => {
  assert.ok(readRepoFile('.git/config').error, '.git not rejected');
  assert.ok(readRepoFile('tools/command-center/node_modules/x.js').error, 'node_modules not rejected');
  assert.ok(readRepoFile('docs/Stakeport__CEE_02_Master_Consolidation_V1.docx').error, 'non-text ext not rejected');
});

test('B6 /api/file: missing path and missing file handled', () => {
  assert.ok(readRepoFile(null).error);
  assert.ok(readRepoFile('agents/founder/outputs/does-not-exist.md').error);
});

test('B2/B3 Repo Health: audit + validation-status model present and read-only', () => {
  const h = getRepoHealth();
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

test('B1 Topology: node-to-node edges resolve to real nodes; provenance present', () => {
  const st = buildState();
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

test('5b-r2 Topology accuracy: lists carry ALL nodes + ALL edges, incl. file-target', () => {
  const st = buildState();
  const t = st.topology;
  const ids = new Set(t.nodes.map(n => n.id.value));
  // Every discovered definition file is represented as a node + an inventory row.
  assert.strictEqual(t.nodes.length, t.repoInventory.length, 'one node per definition file');
  assert.ok(t.nodes.length >= 12, `expected >= 12 nodes, got ${t.nodes.length}`);
  // Edge total matches the Canonical+Derived+nys tally (no silent drops in the data).
  assert.strictEqual(t.edges.length, st.counts.topologyEdges, 'edge count matches state counts');
  // File-target edges (produces/reads → file paths) MUST exist and be present in the
  // data even though the node graph cannot draw them — this is the regression guard.
  let fileTarget = 0;
  for (const e of t.edges) { const to = e.to && !e.to.nys ? e.to.value : null; if (to && !ids.has(to)) fileTarget++; }
  assert.ok(fileTarget > 0, 'expected file-target edges present in the data (listed, not drawn)');
  // Every edge carries a provenance tier so the list can label it.
  for (const e of t.edges) assert.ok(e.tier, 'every edge has a tier field');
});

test('5b-r2 Overview: state exposes everything the home dashboard composes', () => {
  const st = buildState();
  for (const k of ['approvals', 'workItems', 'strategicInitiatives', 'sources', 'roadmap', 'milestones']) {
    assert.ok(Array.isArray(st[k]), `state.${k} is an array for the Overview`);
  }
  // Repo health (audit + validation) is the other Overview input.
  const h = getRepoHealth();
  assert.ok(h.audit && 'everRun' in h.audit, 'overview reads audit.everRun');
  assert.ok(Array.isArray(h.validationCommands), 'overview reads validationCommands');
});
