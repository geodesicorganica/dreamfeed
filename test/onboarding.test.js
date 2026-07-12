'use strict';
// D36 onboarding engine suite: question-tree integrity, deterministic
// rendering, and the strongest exit criterion — scaffolded output ROUND-TRIPS
// through the same parsers the cockpit uses (buildNativeState, loadPolicy,
// readManifest, buildTopology, buildQueue). All against temp dirs; the
// checked-in fixtures and the operator's sidecar are never touched.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DREAMFEED_NO_NATIVE = '1';
if (!process.env.DREAMFEED_STATE_DIR) {
  process.env.DREAMFEED_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'df-state-'));
}

const { QUESTIONS, visibleQuestions, missingRequired } = require('../src/onboarding/questions');
const { render } = require('../src/onboarding/render');
const { generateFamily, FAMILIES, MARKER } = require('../src/onboarding/generate');
const { computePlan } = require('../src/commands/plans');
const { approvePlan, executePlan } = require('../src/commands/executor');
const { loadPolicy } = require('../src/commands/policy');
const { buildNativeState } = require('../src/nativeSchema');
const { buildQueue } = require('../src/queue');
const { readManifest, buildTopology } = require('../src/topology');

const ASOF = '2026-07-07';
const ANSWERS = {
  'q-business-name': 'Acme Studio',
  'q-one-liner': 'Boutique automation studio for indie retailers.',
  'q-operator-name': 'Jorge',
  'q-stage': 'building',
  'q-customer': 'Independent retail shop owners with 1-5 locations.',
  'q-model': 'Monthly retainers | setup fees.', // pipe on purpose: must never break a table
  'q-success-12mo': 'Ten retained customers and a repeatable delivery playbook.',
  'q-positioning': 'Faster than an agency, more accountable than a freelancer.',
  'q-brand-voice': 'warm-approachable',
  'q-brand-values': 'honesty, craft, speed',
  'q-goal-title': 'Land the first three retainer customers',
  'q-goal-milestone': 'First signed retainer',
  'q-goal-first-task': 'List 20 candidate shops and rank by fit',
  'q-goal-target-date': '2026-10-01',
  'q-cadences': ['weekly-review', 'outreach'],
  'q-agent-domains': ['content-marketing', 'sales'],
  'q-coding-agent': 'claude-code',
  'q-conventions': 'Never touch customer data outside the sandbox.',
};

function tmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'df-onb-'));
}

// --- tree integrity ----------------------------------------------------------

test('question tree: unique ids, valid showIf targets, options where required', () => {
  const ids = new Set();
  for (const q of QUESTIONS) {
    assert.ok(/^q-[a-z0-9-]+$/.test(q.id), `${q.id}: id shape`);
    assert.ok(!ids.has(q.id), `${q.id}: duplicate id`);
    ids.add(q.id);
    assert.ok(q.prompt && q.family && q.kind, `${q.id}: prompt/family/kind required`);
    if (q.showIf) assert.ok(QUESTIONS.some((x) => x.id === q.showIf.questionId), `${q.id}: showIf target exists`);
    if (q.kind === 'choice' || q.kind === 'multi') assert.ok(Array.isArray(q.options) && q.options.length >= 2, `${q.id}: options`);
  }
});

test('question tree: branching hides, required gating works', () => {
  const idea = visibleQuestions({ 'q-stage': 'idea' }).map((q) => q.id);
  assert.ok(idea.includes('q-model-hypothesis') && !idea.includes('q-model'));
  const operating = visibleQuestions({ 'q-stage': 'operating' }).map((q) => q.id);
  assert.ok(operating.includes('q-model') && !operating.includes('q-model-hypothesis'));
  assert.ok(missingRequired({}).includes('q-business-name'));
  assert.deepStrictEqual(missingRequired(ANSWERS), []);
});

test('every template placeholder maps to a real question id', () => {
  const dir = path.join(__dirname, '..', 'src', 'onboarding', 'templates');
  const ids = new Set(QUESTIONS.map((q) => q.id));
  for (const name of fs.readdirSync(dir)) {
    const text = fs.readFileSync(path.join(dir, name), 'utf8');
    for (const m of text.matchAll(/\{\{(?:#if )?q:([a-z0-9-]+)\}\}/g)) {
      assert.ok(ids.has(m[1]), `${name}: unknown question {{q:${m[1]}}}`);
    }
  }
});

// --- renderer ----------------------------------------------------------------

test('renderer: substitution, if-blocks, pipe-escaping in table rows, provenance', () => {
  const tpl = '# Head\n\n{{q:q-one-liner}}\n\n{{#if q:q-missing-x}}HIDDEN{{/if}}{{#if q:q-stage}}shown{{/if}}\n\n| a | {{q:q-model}} |\n';
  const out = render(tpl, ANSWERS, {});
  assert.ok(out.content.includes('Boutique automation studio'));
  assert.ok(!out.content.includes('HIDDEN'));
  assert.ok(out.content.includes('shown'));
  assert.ok(out.content.includes('Monthly retainers \\| setup fees.'), 'pipes escaped inside table rows');
  assert.deepStrictEqual(out.provenance, [{ section: 'Head', questionIds: ['q-one-liner', 'q-missing-x', 'q-stage', 'q-model'] }]);
});

// --- generation ----------------------------------------------------------------

test('generateFamily is deterministic and every file carries provenance', () => {
  const root = tmpProject();
  for (const family of FAMILIES) {
    const a = generateFamily(family, { repoRoot: root, answers: ANSWERS, families: FAMILIES, asOfDate: ASOF });
    const b = generateFamily(family, { repoRoot: root, answers: ANSWERS, families: FAMILIES, asOfDate: ASOF });
    assert.deepStrictEqual(a, b, `${family}: two runs identical`);
    assert.ok(a.files.length, `${family}: produces files`);
    for (const f of a.files) {
      assert.strictEqual(f.baseHash, null, `${family}/${f.path}: create semantics on empty repo`);
      assert.ok(Array.isArray(f.provenance) && f.provenance.length, `${family}/${f.path}: provenance present`);
      assert.ok(f.content.length < 512 * 1024, `${family}/${f.path}: under write cap`);
    }
  }
});

test('scaffolded output round-trips through the cockpit parsers', () => {
  const root = tmpProject();
  for (const family of FAMILIES) {
    const out = generateFamily(family, { repoRoot: root, answers: ANSWERS, families: FAMILIES, asOfDate: ASOF });
    for (const f of out.files) {
      const abs = path.join(root, f.path);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, f.content, 'utf8');
    }
  }
  const native = buildNativeState({ repoRoot: root, today: new Date(`${ASOF}T12:00:00Z`) });
  assert.strictEqual(native.hasNative, true);
  assert.deepStrictEqual(native.parseErrors, [], 'scaffolded os/ parses with ZERO errors');
  assert.strictEqual(native.goals.length, 1);
  assert.strictEqual(native.goals[0].title.value, 'Land the first three retainer customers');
  assert.strictEqual(native.goals[0].phases.length, 1);
  assert.strictEqual(native.goals[0].phases[0].milestones[0].tasks.length, 1);
  assert.strictEqual(native.operations.length, 2, 'one operation per selected cadence');

  const queue = buildQueue({ repoRoot: root, today: new Date(`${ASOF}T12:00:00Z`) });
  assert.ok(queue.sections.today.length >= 1, 'the payoff moment: the queue is non-empty on day one');
  assert.ok(queue.sections.today.some((e) => e.task.title.value.includes('List 20 candidate shops')));

  const policy = loadPolicy(root);
  assert.strictEqual(policy.source, 'os/policy.md', 'generated policy file is the live policy source');
  assert.strictEqual(policy.classes['git-push'], 'founder');
  assert.strictEqual(policy.classes['scaffold-project'], 'approve');

  const manifest = readManifest(root);
  assert.deepStrictEqual(manifest.errors, [], 'generated topology manifest parses clean');
  assert.ok(manifest.nodes.length >= 3, 'document/memory nodes promoted');

  const topo = buildTopology(root);
  const agentIds = topo.nodes.filter((n) => n.nodeType === 'agent').map((n) => n.id.value);
  for (const id of ['founder', 'chief-of-staff', 'content-marketing', 'sales']) {
    assert.ok(agentIds.includes(id), `agent ${id} parses from agents/*/AGENT.md`);
  }
});

test('merge, never overwrite: existing CLAUDE.md is appended once, second pass skips', () => {
  const root = tmpProject();
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# Existing rules\n\nDo not delete me.\n', 'utf8');
  const first = generateFamily('harness', { repoRoot: root, answers: ANSWERS, families: FAMILIES, asOfDate: ASOF });
  const claude = first.files.find((f) => f.path === 'CLAUDE.md');
  assert.ok(claude && !claude.create && claude.baseHash, 'existing file → merge with real baseHash');
  assert.ok(claude.content.startsWith('# Existing rules'), 'original content preserved');
  assert.ok(claude.content.includes(MARKER), 'marker delimits the appended section');
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), claude.content, 'utf8');
  const second = generateFamily('harness', { repoRoot: root, answers: ANSWERS, families: FAMILIES, asOfDate: ASOF });
  assert.ok(!second.files.some((f) => f.path === 'CLAUDE.md'), 'marker present → skipped');
  assert.ok(second.warnings.some((w) => w.includes('CLAUDE.md')), 'skip is disclosed, never silent');
});

test('existing os files are skipped with warnings, topology merges instead', () => {
  const root = tmpProject();
  fs.mkdirSync(path.join(root, 'os', 'goals'), { recursive: true });
  fs.writeFileSync(path.join(root, 'os', 'goals', 'land-the-first-three-retainer-customers.md'), 'existing goal\n', 'utf8');
  fs.writeFileSync(path.join(root, 'os', 'topology.md'), [
    '---', 'definition_type: topology_manifest', 'schema: dreamfeed-topology/v1', '---', '',
    '# Topology Manifest', '', '## Nodes', '',
    '| Id | Kind | Name | Promoted From | Matched By |', '|---|---|---|---|---|',
    '| legacy | skill | Legacy Skill | tools/legacy.md | path:tools |', '',
    '## Edges', '', '| From | Type | To |', '|---|---|---|', '',
  ].join('\n'), 'utf8');
  const out = generateFamily('os-core', { repoRoot: root, answers: ANSWERS, families: FAMILIES, asOfDate: ASOF });
  assert.ok(out.warnings.some((w) => w.includes('land-the-first-three-retainer-customers.md')), 'goal collision disclosed');
  const topo = out.files.find((f) => f.path === 'os/topology.md');
  assert.ok(topo && topo.baseHash && !topo.create, 'existing manifest → merge');
  assert.ok(topo.content.includes('| legacy |'), 'pre-existing manifest rows survive the merge');
  assert.ok(topo.content.includes('| doc-strategy |'), 'new rows added');
});

// --- planner + executor ---------------------------------------------------------

test('scaffold-project plans are approve-class, per-file hash-bound, allowlisted', () => {
  const root = tmpProject();
  const policy = loadPolicy(root);
  const intent = { id: 'int_test1', kind: 'scaffold-project', payload: { family: 'os-core', answers: ANSWERS, families: FAMILIES, asOfDate: ASOF } };
  const out = computePlan(intent, { repoRoot: root, policy });
  assert.ok(!out.error, out.error);
  assert.strictEqual(out.plan.class, 'approve');
  assert.ok(out.plan.ops.length >= 4);
  for (const op of out.plan.ops) {
    assert.strictEqual(op.type, 'write-file');
    assert.strictEqual(op.baseHash, null);
    assert.match(op.path, /^os\//);
  }
  assert.ok(out.plan.preview.files.every((f) => Array.isArray(f.diff) && f.diff.length), 'every file previews a diff');
  const bad = computePlan({ id: 'int_test2', kind: 'scaffold-project', payload: { family: 'nope' } }, { repoRoot: root, policy });
  assert.strictEqual(bad.code, 'validation');
});

test('end-to-end: approve + execute a scaffold plan, then drift on one file refuses the whole batch', () => {
  const root = tmpProject();
  const policy = loadPolicy(root);
  const mk = (id) => computePlan({ id, kind: 'scaffold-project', payload: { family: 'os-core', answers: ANSWERS, families: FAMILIES, asOfDate: ASOF } }, { repoRoot: root, policy });
  const first = mk('int_e2e1');
  assert.ok(!first.error);
  const a = approvePlan(first.plan, { actor: 'operator' }, root);
  assert.ok(!a.error, a.error);
  const x = executePlan(first.plan, { actor: 'operator' }, root);
  assert.strictEqual(x.execution.status, 'succeeded');
  assert.ok(fs.existsSync(path.join(root, 'os', 'policy.md')));
  assert.strictEqual(buildNativeState({ repoRoot: root }).hasNative, true);

  // Second plan against the SAME empty-state expectations, then let one target
  // appear before approval: baseHash null means "must not exist" → drift.
  fs.rmSync(path.join(root, 'os'), { recursive: true, force: true });
  const second = mk('int_e2e2');
  assert.ok(!second.error);
  fs.mkdirSync(path.join(root, 'os'), { recursive: true });
  fs.writeFileSync(path.join(root, 'os', 'policy.md'), 'sneaky edit\n', 'utf8');
  const refused = approvePlan(second.plan, { actor: 'operator' }, root);
  assert.strictEqual(refused.code, 'drift');
  assert.match(refused.error, /os\/policy\.md/);
});

test('git-init: plannable on a non-repo, refused once a repo exists', () => {
  const root = tmpProject();
  const policy = loadPolicy(root);
  const out = computePlan({ id: 'int_git1', kind: 'git-init', payload: {} }, { repoRoot: root, policy });
  assert.ok(!out.error, out.error);
  assert.strictEqual(out.plan.class, 'approve');
  assert.deepStrictEqual(out.plan.ops, [{ type: 'git', args: ['init', '-b', 'main'] }]);
  const a = approvePlan(out.plan, { actor: 'operator' }, root);
  assert.ok(!a.error, a.error);
  const x = executePlan(out.plan, { actor: 'operator', health: { isRepo: false } }, root);
  assert.strictEqual(x.execution.status, 'succeeded', x.execution.error);
  assert.ok(fs.existsSync(path.join(root, '.git')), 'git init actually ran');

  const again = computePlan({ id: 'int_git2', kind: 'git-init', payload: {} }, { repoRoot: root, policy });
  const a2 = approvePlan(again.plan, { actor: 'operator' }, root);
  assert.ok(!a2.error);
  const x2 = executePlan(again.plan, { actor: 'operator', health: { isRepo: true } }, root);
  assert.strictEqual(x2.error && x2.code, 'state', 'init refused on an existing repo');

  // The exemption is op-scoped: other git ops still require a repo.
  const add = computePlan({ id: 'int_git3', kind: 'git-add', payload: {} }, { repoRoot: root, policy });
  const a3 = approvePlan(add.plan, { actor: 'operator' }, root);
  assert.ok(!a3.error);
  const x3 = executePlan(add.plan, { actor: 'operator', health: { isRepo: false, safeReason: 'not a git repository' } }, root);
  assert.strictEqual(x3.code, 'unsafe');
});
