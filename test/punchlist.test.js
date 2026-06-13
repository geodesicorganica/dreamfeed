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
