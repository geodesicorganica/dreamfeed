'use strict';
// Stakeport-specific Brief B + Phase 0b + Goal C tests (live files).
// Requires DREAMFEED_STAKEPORT_ROOT to be set.
const STAKEPORT_ROOT = process.env.DREAMFEED_STAKEPORT_ROOT;
if (!STAKEPORT_ROOT) { process.exit(0); }

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { buildState } = require('../../src/state');
const { buildTopology, buildRoadmap, discoverDefinitionFiles } = require('../../src/topology');
const { getRepoHealth } = require('../../src/repohealth');
const { parseFile } = require('../../src/parse');

const TIERS = ['Canonical', 'Derived', 'Candidate'];

test('Phase 0b: all 5 AGENT.md + 7 SKILL.md carry definition frontmatter', () => {
  const defs = discoverDefinitionFiles(STAKEPORT_ROOT);
  const agents = defs.filter(d => d.kind === 'agent');
  const skills = defs.filter(d => d.kind === 'skill');
  assert.ok(agents.length >= 5, `expected >=5 AGENT.md, got ${agents.length}`);
  assert.ok(skills.length >= 7, `expected >=7 SKILL.md, got ${skills.length}`);
  for (const d of defs) {
    const f = parseFile(d.file);
    assert.ok(f.frontmatter && f.frontmatter.definition_type, `${f.path} missing definition_type frontmatter`);
    assert.strictEqual(f.frontmatter.definition_type, d.kind, `${f.path} definition_type mismatch`);
    assert.strictEqual(f.frontmatter.schema_version, 'v1');
  }
});

test('Topology: Canonical edges from frontmatter, every edge tiered + source-evidenced (Gate C Amendment 1)', () => {
  const t = buildTopology(STAKEPORT_ROOT);
  assert.ok(t.nodes.length >= 12, `expected >=12 nodes, got ${t.nodes.length}`);
  assert.ok(t.tally.Canonical > 0, 'expected Canonical edges from Phase 0b frontmatter');
  for (const e of t.edges) {
    if (!e.tier.nys) assert.ok(['Canonical', 'Derived'].includes(e.tier.value), 'edge tier must be Canonical or Derived');
    assert.ok(e.source_evidence && !e.source_evidence.nys, 'every edge cites source evidence');
  }
  const owns = t.edges.find(e => e.type.value === 'owns' && e.from.value === 'founder' && e.to.value === 'goal-setting');
  assert.ok(owns, 'founder->goal-setting owns edge present');
  assert.strictEqual(owns.tier.value, 'Canonical');
  const dep = t.edges.find(e => e.type.value === 'depends-on' && e.from.value === 'priority-setting' && e.to.value === 'goal-setting');
  assert.ok(dep && dep.tier.value === 'Canonical', 'priority-setting depends-on goal-setting Canonical');
});

test('Roadmap Spine: Phase nodes parsed; roadmap terms not crawl|walk|run (FR13)', () => {
  const r = buildRoadmap(STAKEPORT_ROOT);
  assert.ok(r.objects.length >= 3, `expected >=3 roadmap phases, got ${r.objects.length}`);
  for (const o of r.objects) {
    assert.match(o.phase_label.value, /^Phase\s+[0-9.]+$/, 'phase_label is a roadmap term');
    assert.ok(!/crawl|walk|run/i.test(o.phase_label.value), 'roadmap term not conflated with build-maturity term');
    assert.strictEqual(o.phase_label.tier, 'Derived');
  }
});

test('Milestone: degraded by design — state not-yet-structured, never inferred complete', () => {
  const st = buildState({ repoRoot: STAKEPORT_ROOT });
  assert.ok(st.milestones.length >= 3);
  for (const m of st.milestones) {
    assert.strictEqual(m.state.nys, true, 'milestone state must be not-yet-structured');
    assert.strictEqual(m.state.tier, 'Candidate');
    assert.strictEqual(m.freshness.nys, true, 'untyped roadmap source → freshness nys');
    assert.ok(m.phase_label && !m.phase_label.nys);
  }
});

test('Review: objects span schema families; every object tiered + source-evidenced', () => {
  const st = buildState({ repoRoot: STAKEPORT_ROOT });
  assert.ok(st.reviews.length > 0, 'expected review objects');
  const families = new Set(st.reviews.map(o => o.schema_family.value));
  assert.ok(families.has('governance'), 'review surface includes governance artifacts');
  for (const o of st.reviews) {
    for (const [k, v] of Object.entries(o)) {
      if (k === 'objectType') continue;
      assert.ok(v && (TIERS.includes(v.tier)), `review field ${k} untiered`);
    }
    assert.ok(!o.source_evidence.nys, 'review object cites source evidence');
  }
});

test('Learning Signal: no orphans — every rendered signal Candidate + traceable source', () => {
  const st = buildState({ repoRoot: STAKEPORT_ROOT });
  for (const s of st.learningSignals) {
    assert.strictEqual(s.signal.tier, 'Candidate');
    assert.strictEqual(s.confidence.tier, 'Candidate');
    assert.notStrictEqual(s.confidence.value, 'high', 'confidence never defaults to high');
    assert.ok(s.source_artifact && !s.source_artifact.nys, 'signal must have a traceable source (no orphan)');
  }
});

test('Goal C Repo Health: returns branch + numeric counts for Stakeport root', () => {
  const h = getRepoHealth(STAKEPORT_ROOT);
  assert.strictEqual(h.readOnly, true);
  assert.strictEqual(h.isRepo, true);
  assert.ok(typeof h.branch === 'string' && h.branch.length > 0);
  assert.ok(Number.isInteger(h.counts.staged) && Number.isInteger(h.counts.unstaged) && Number.isInteger(h.counts.untracked));
  assert.ok(typeof h.safeToProceed === 'boolean' || h.safeToProceed === null);
  assert.ok(Array.isArray(h.validationCommands));
});

test('Operational Core (Brief A) behavior preserved alongside Brief B', () => {
  const st = buildState({ repoRoot: STAKEPORT_ROOT });
  assert.strictEqual(st.strategicInitiatives.length, st.counts.strategicInitiatives);
  assert.ok(st.workItems.length > 0);
  assert.ok(st.approvalQueue.length > 0);
  assert.ok(st.topology && st.roadmap && st.milestones && st.reviews && st.learningSignals);
});

test('zero write-back: building full state (A+B) changes no source file mtime', () => {
  const targets = [
    'agents/founder/outputs/strategic_initiatives.md',
    'agents/founder/AGENT.md',
    'agents/founder/skills/goal-setting/SKILL.md',
    'CLAUDE.md',
    'shared/cockpit-integration-guide.md',
  ];
  const before = targets.map(t => fs.statSync(path.join(STAKEPORT_ROOT, t)).mtimeMs);
  buildState({ repoRoot: STAKEPORT_ROOT }); buildState({ repoRoot: STAKEPORT_ROOT });
  const after = targets.map(t => fs.statSync(path.join(STAKEPORT_ROOT, t)).mtimeMs);
  assert.deepStrictEqual(after, before);
});
