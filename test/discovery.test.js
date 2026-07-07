'use strict';
// D32 discovery scanner + manifest adapter tests. Fixture repos:
// unadopted (agentic material, no formal topology) and half-adopted
// (an os/topology.md manifest plus unmapped files). The truly-empty case uses
// a fresh temp dir because git cannot track an empty directory.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { discover } = require('../src/discovery');
const { buildTopology, readManifest, MANIFEST_SCHEMA } = require('../src/topology');

const FIX = (name) => path.join(__dirname, 'fixtures', 'discovery', name);

test('unadopted repo: role-based rules find candidates with explainable evidence', () => {
  const out = discover(FIX('unadopted'));
  const byKind = (k) => out.candidates.filter((c) => c.kind === k);
  // prompts/ -> skill; .github/workflows -> workflow; package scripts -> workflow;
  // README -> document; notes/ -> memory; src/ -> code surface; reviewer.md ->
  // agent via frontmatter role + heading sniff.
  assert.ok(byKind('skill').some((c) => c.sourcePath === 'prompts/summarize.md'), 'prompts dir yields skill candidates');
  assert.ok(byKind('workflow').some((c) => c.sourcePath === '.github/workflows/ci.yml'), 'CI workflows are candidates');
  assert.ok(byKind('workflow').some((c) => c.matchedBy.includes('script:build')), 'package scripts are one explainable candidate');
  assert.ok(byKind('document').some((c) => c.sourcePath === 'README.md'), 'root docs are candidates');
  assert.ok(byKind('memory').some((c) => c.sourcePath === 'notes'), 'notes/ is a memory candidate');
  assert.ok(byKind('code-surface').some((c) => c.sourcePath === 'src'), 'src/ is a code surface');
  const reviewer = byKind('agent').find((c) => c.sourcePath === 'reviewer.md');
  assert.ok(reviewer, 'markdown sniff finds the reviewer agent');
  assert.ok(reviewer.matchedBy.some((m) => m.startsWith('frontmatter:role')), 'frontmatter evidence is recorded');
  for (const c of out.candidates) {
    assert.strictEqual(c.provenance, 'discovered');
    assert.ok(['high', 'medium', 'low'].includes(c.confidence), `${c.id} has a confidence tier`);
    assert.ok(Array.isArray(c.matchedBy) && c.matchedBy.length, `${c.id} explains why it was found`);
    assert.ok(c.sourcePath, `${c.id} carries its source path`);
  }
});

test('unmatched files roll up by top-level directory — never per-file node spam', () => {
  const out = discover(FIX('unadopted'));
  const assets = out.rollups.find((r) => r.sourcePath === 'assets');
  assert.ok(assets, 'assets/ rolls up');
  assert.strictEqual(assets.kind, 'unmapped');
  assert.strictEqual(assets.count, 2);
  assert.ok(!out.candidates.some((c) => c.sourcePath.startsWith('assets/')), 'no per-file asset candidates');
});

test('discovery is deterministic and read-only', () => {
  const a = discover(FIX('unadopted'));
  const b = discover(FIX('unadopted'));
  assert.deepStrictEqual(a, b, 'two scans produce identical output');
});

test('truly empty project: valid empty result, no errors', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'df-empty-'));
  try {
    const out = discover(dir);
    assert.deepStrictEqual(out.candidates, []);
    assert.deepStrictEqual(out.rollups, []);
    assert.deepStrictEqual(out.errors, []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('manifest adapter: promoted os/topology.md objects parse as Canonical', () => {
  const m = readManifest(FIX('half-adopted'));
  assert.strictEqual(m.present, true);
  assert.strictEqual(m.hasFrontmatter, true);
  assert.strictEqual(m.nodes.length, 2);
  const agent = m.nodes.find((n) => n.id.value === 'summarizer');
  assert.strictEqual(agent.nodeType, 'agent');
  assert.strictEqual(agent.id.tier, 'Canonical');
  assert.strictEqual(agent.status.value, 'promoted');
  assert.strictEqual(m.edges.length, 1);
  assert.strictEqual(m.edges[0].tier.value, 'Canonical');
  assert.match(m.edges[0].source_evidence.value.file, /os\/topology\.md/);
});

test('manifest adapter: schema-less os/topology.md is not promoted as Canonical truth', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'df-schemalessmanifest-'));
  try {
    fs.mkdirSync(path.join(dir, 'os'));
    fs.writeFileSync(path.join(dir, 'os', 'topology.md'), [
      '# Topology Notes', '',
      '| Id | Kind | Name |', '|---|---|---|', '| x | agent | X |', '',
    ].join('\n'));
    const m = readManifest(dir);
    assert.strictEqual(m.present, true);
    assert.strictEqual(m.nodes.length, 0);
    assert.strictEqual(m.edges.length, 0);
    assert.strictEqual(m.errors.length, 1);
    assert.match(m.errors[0].error, new RegExp(MANIFEST_SCHEMA));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('manifest merges into buildTopology alongside (absent) definition files', () => {
  const t = buildTopology(FIX('half-adopted'));
  const ids = t.nodes.map((n) => n.id.value);
  assert.ok(ids.includes('summarizer') && ids.includes('ci-build'), 'manifest nodes appear in the topology');
  assert.ok(t.edges.some((e) => e.from.value === 'summarizer' && e.type.value === 'produces'));
  assert.ok(t.repoInventory.some((r) => r.path.value === 'os/topology.md' && r.kind.value === 'topology-manifest'));
  assert.strictEqual(t.tally.Canonical >= 1, true, 'manifest edges count as Canonical in the tally');
});

test('manifest rejects unknown kinds and edge types as errors, not silent truth', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'df-badmanifest-'));
  try {
    fs.mkdirSync(path.join(dir, 'os'));
    fs.writeFileSync(path.join(dir, 'os', 'topology.md'), [
      '---', 'schema: dreamfeed-topology/v1', '---', '',
      '## Nodes', '', '| Id | Kind | Name |', '|---|---|---|', '| x | martian | X |', '',
      '## Edges', '', '| From | Type | To |', '|---|---|---|', '| x | teleports | y |', '',
    ].join('\n'));
    const m = readManifest(dir);
    assert.strictEqual(m.nodes.length, 0);
    assert.strictEqual(m.edges.length, 0);
    assert.strictEqual(m.errors.length, 2);
    assert.match(m.errors[0].error, /unknown kind "martian"/);
    assert.match(m.errors[1].error, /unknown type "teleports"/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('ecosystem manifests are workflow candidates regardless of language', () => {
  const out = discover(FIX('unadopted'));
  const wf = out.candidates.filter((c) => c.kind === 'workflow').map((c) => c.sourcePath);
  assert.ok(wf.includes('go.mod'), 'Go module manifest is a workflow candidate');
  assert.ok(wf.includes('pyproject.toml'), 'Python project manifest is a workflow candidate');
});
