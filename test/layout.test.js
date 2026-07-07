'use strict';
// D32 layout orchestrator tests. Executable (not regex): public/layout.js is
// pure and node-loadable. Fixtures cover the four project shapes from the
// D32 dry runs: stakeport (full governance), empty, no-reports-chain
// (cascade rule 3), declared-human (cascade rule 1).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const layout = require('../public/layout.js');
const { orchestrate, HUMAN_ROOT_ID, STRATEGIES } = layout;

const fixture = (name) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'topology', `${name}.json`), 'utf8'));

const SHAPES = ['stakeport', 'empty', 'no-reports', 'human'];

// --- product invariants -----------------------------------------------------------

test('the human is the root of every spec — runtime provenance, never a repo object', () => {
  for (const name of SHAPES) {
    const spec = orchestrate(fixture(name));
    assert.strictEqual(spec.rootNodeId, HUMAN_ROOT_ID, `${name}: root must be the human`);
    assert.strictEqual(spec.rootNodeKind, 'human');
    assert.strictEqual(spec.rootRule, 'product-invariant');
    assert.strictEqual(spec.rootProvenance, 'runtime');
    assert.deepStrictEqual(spec.layers[0].nodeIds, [HUMAN_ROOT_ID], `${name}: layer 0 belongs to the human alone`);
  }
});

test('root and anchor are distinct: the anchor is source-backed, the cascade only picks it', () => {
  const stakeport = orchestrate(fixture('stakeport'));
  assert.strictEqual(stakeport.anchorNodeId, 'founder');
  assert.strictEqual(stakeport.anchorRule, 'reports-to-sink');
  assert.strictEqual(stakeport.anchorProvenance, 'source-backed');

  const noReports = orchestrate(fixture('no-reports'));
  assert.strictEqual(noReports.anchorNodeId, 'planner', 'agentic nodes outrank artifacts for the anchor');
  assert.strictEqual(noReports.anchorRule, 'max-flow-reachability');

  const human = orchestrate(fixture('human'));
  assert.strictEqual(human.anchorNodeId, 'alice', 'a repo-declared primary human becomes the anchor');
  assert.strictEqual(human.anchorRule, 'human-node');

  const empty = orchestrate(fixture('empty'));
  assert.strictEqual(empty.anchorNodeId, null);
  assert.strictEqual(empty.fallbackMode, 'empty-graph');
  assert.strictEqual(empty.rootNodeId, HUMAN_ROOT_ID, 'even an empty project renders the human');
});

test('never show nothing / never drop a node: every input node is positioned exactly once', () => {
  for (const name of SHAPES) {
    const g = fixture(name);
    const spec = orchestrate(g);
    const placed = new Map(spec.nodes.map((n) => [n.id, n]));
    assert.strictEqual(placed.size, spec.nodes.length, `${name}: no duplicate positions`);
    for (const n of g.nodes) assert.ok(placed.has(n.id), `${name}: declared node ${n.id} must be placed`);
    for (const e of g.edges) {
      assert.ok(placed.has(e.from) && placed.has(e.to), `${name}: edge endpoint ${e.from}/${e.to} must be placed`);
    }
    assert.ok(placed.has(HUMAN_ROOT_ID), `${name}: human root placed`);
    for (const n of spec.nodes) {
      assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y), `${name}: ${n.id} has finite coordinates`);
    }
  }
});

// --- data-flow normalization -------------------------------------------------------

test('consumes-from and reads are reversed for layering: layers follow work product', () => {
  // reviewer is reachable ONLY through the reversed reads edge
  // (notes.md -> reviewer), so it must layer deeper than the artifact.
  // Under as-declared direction it would be unreachable by flow entirely.
  const g = {
    nodes: [
      { id: 'lead', kind: 'agent', name: 'Lead' },
      { id: 'writer', kind: 'agent', name: 'Writer' },
      { id: 'reviewer', kind: 'agent', name: 'Reviewer' },
    ],
    edges: [
      { from: 'lead', to: 'writer', type: 'dispatches-to' },
      { from: 'writer', to: 'notes.md', type: 'produces' },
      { from: 'reviewer', to: 'notes.md', type: 'reads' },
    ],
  };
  const spec = orchestrate(g);
  const layerOf = new Map(spec.nodes.map((n) => [n.id, n.layer]));
  assert.ok(layerOf.get('notes.md') < layerOf.get('reviewer'),
    'the artifact must be shallower than an agent reachable only by reading it');
  // Declared direction is preserved on the spec edges for arrowheads.
  const readsEdge = spec.edges.find((e) => e.type === 'reads');
  assert.deepStrictEqual({ from: readsEdge.from, to: readsEdge.to }, { from: 'reviewer', to: 'notes.md' });
});

test('every edge is categorized and the runtime human->anchor edge exists', () => {
  const spec = orchestrate(fixture('stakeport'));
  for (const e of spec.edges) assert.ok(['flow', 'structure', 'runtime'].includes(e.category));
  const runtime = spec.edges.filter((e) => e.category === 'runtime');
  assert.strictEqual(runtime.length, 1);
  assert.deepStrictEqual(
    { from: runtime[0].from, to: runtime[0].to, type: runtime[0].type },
    { from: HUMAN_ROOT_ID, to: 'founder', type: 'operates' });
  // All 86 declared stakeport edges survive plus the runtime edge.
  assert.strictEqual(spec.edges.length, fixture('stakeport').edges.length + 1);
});

// --- strategies -----------------------------------------------------------------

test('strategy auto-selection: layered for large graphs, radial for small ones', () => {
  assert.strictEqual(orchestrate(fixture('stakeport')).strategy, 'layered');
  assert.strictEqual(orchestrate(fixture('no-reports')).strategy, 'radial');
  assert.strictEqual(orchestrate(fixture('human')).strategy, 'radial');
});

test('manual override is honored, disclosed, and falls back with a warning when unrenderable', () => {
  for (const s of STRATEGIES) {
    if (s === 'clustered-loops') continue; // covered below: fixtures have no loops
    const spec = orchestrate(fixture('stakeport'), { strategy: s });
    assert.strictEqual(spec.strategy, s, `override to ${s} honored`);
    assert.strictEqual(spec.strategyRequested, s);
    assert.ok(spec.strategyAuto, 'auto choice still disclosed under override');
  }
  // clustered-loops with zero loops cannot cleanly render: warn + fall back.
  const spec = orchestrate(fixture('stakeport'), { strategy: 'clustered-loops' });
  assert.strictEqual(spec.strategy, spec.strategyAuto);
  assert.ok(spec.warnings.some((w) => w.includes('clustered-loops')), 'fallback is warned, not silent');
});

test('clustered-loops renders when loops exist', () => {
  // Synthetic delivery loop: dispatch down, produce, read back.
  const g = {
    nodes: [
      { id: 'a', kind: 'agent', name: 'A' }, { id: 'b', kind: 'agent', name: 'B' },
      { id: 'c', kind: 'agent', name: 'C' },
    ],
    edges: [
      { from: 'a', to: 'b', type: 'dispatches-to' },
      { from: 'b', to: 'out.md', type: 'produces' },
      { from: 'a', to: 'out.md', type: 'reads' }, // reversed: out.md -> a closes the loop
      { from: 'b', to: 'a', type: 'reports-to' },
      { from: 'a', to: 'c', type: 'dispatches-to' },
    ],
  };
  const auto = orchestrate(g);
  assert.ok(auto.loops.length >= 1, 'produce -> read closes a flow cycle');
  assert.strictEqual(auto.loops[0].weight, 'primary');
  const forced = orchestrate(g, { strategy: 'clustered-loops' });
  assert.strictEqual(forced.strategy, 'clustered-loops');
  const clustered = forced.nodes.filter((n) => n.cluster);
  assert.ok(clustered.length >= 2, 'loop members carry their cluster id');
});

test('the why line is concrete: node count, layers, loops', () => {
  const spec = orchestrate(fixture('stakeport'));
  assert.match(spec.why, /^\d+ nodes · \d+ layers · \d+ loops/);
  const forced = orchestrate(fixture('stakeport'), { strategy: 'radial' });
  assert.match(forced.why, /manual override$/);
});

// --- determinism ------------------------------------------------------------------

test('deterministic: identical spec across runs for every fixture', () => {
  for (const name of SHAPES) {
    const a = orchestrate(fixture(name));
    const b = orchestrate(fixture(name));
    assert.deepStrictEqual(a, b, `${name}: two runs must produce identical specs`);
  }
});

test('input is read-only: orchestrate never mutates the graph', () => {
  const g = fixture('no-reports');
  const snapshot = JSON.stringify(g);
  orchestrate(g);
  assert.strictEqual(JSON.stringify(g), snapshot);
});

// --- scale: project-agnostic by size ------------------------------------------

test('deep graphs widen the canvas instead of clipping (300-node chain)', () => {
  const nodes = Array.from({ length: 300 }, (_, i) => ({ id: `n${i}`, kind: 'agent', name: `N${i}` }));
  const edges = Array.from({ length: 299 }, (_, i) => ({ from: `n${i}`, to: `n${i + 1}`, type: 'dispatches-to' }));
  const spec = orchestrate({ nodes, edges }, { strategy: 'layered' });
  const w = spec.constraints.canvasWidth;
  assert.ok(w > 1220, 'canvas width grows for deep graphs');
  for (const n of spec.nodes) {
    assert.ok(n.x >= 0 && n.x <= w, `${n.id} x=${n.x} must sit inside the ${w}px canvas`);
    assert.ok(n.y >= 0 && n.y <= spec.constraints.canvasHeight, `${n.id} y within canvas`);
  }
  assert.strictEqual(spec.nodes.length, 301, 'every node placed (300 + human)');
});

test('dense graphs terminate under the loop-detection work budget', () => {
  const N = 60;
  const nodes = Array.from({ length: N }, (_, i) => ({ id: `d${i}`, kind: 'agent', name: `D${i}` }));
  const edges = [];
  for (let i = 0; i < N; i++) for (let j = 1; j <= 12; j++) edges.push({ from: `d${i}`, to: `d${(i + j) % N}`, type: 'dispatches-to' });
  const spec = orchestrate({ nodes, edges });
  assert.ok(spec.loops.length > 0 && spec.loops.length <= 24, 'loop count found and capped');
  assert.strictEqual(spec.nodes.length, N + 1, 'all nodes placed despite density');
  assert.ok(spec.warnings.some((w) => w.includes('work budget') || w.includes('capped')), 'bounded work is disclosed');
});

test('radial with many rings also grows the canvas', () => {
  const nodes = Array.from({ length: 30 }, (_, i) => ({ id: `r${i}`, kind: 'agent', name: `R${i}` }));
  const edges = Array.from({ length: 29 }, (_, i) => ({ from: `r${i}`, to: `r${i + 1}`, type: 'dispatches-to' }));
  const spec = orchestrate({ nodes, edges }, { strategy: 'radial' });
  const w = spec.constraints.canvasWidth;
  for (const n of spec.nodes) assert.ok(n.x >= 0 && n.x <= w, `${n.id} x=${n.x} inside ${w}px`);
});
