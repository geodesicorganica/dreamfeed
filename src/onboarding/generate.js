'use strict';
// D36 artifact generator: pure function of (answers, imports, templates,
// current repo state). Produces the exact file set for ONE artifact family —
// the scaffold-project planner turns it into a hash-bound multi-op plan.
//
// Merge discipline (D36 invariant "merge, never overwrite"):
//   - harness files (CLAUDE.md / AGENTS.md) that already exist get a
//     marker-delimited section APPENDED; if the marker is already present the
//     file is skipped with a warning.
//   - os/topology.md merges nodes/edges (same semantics as promote-topology).
//   - every other existing target is skipped with a warning.
//
// Reads the repo (existence + current content for baseHash) but never writes.

const fs = require('fs');
const path = require('path');
const { slugify } = require('../parse');
const { hashText } = require('../write');
const { render } = require('./render');
const { readManifest } = require('../topology');

const FAMILIES = Object.freeze(['os-core', 'agents', 'harness', 'docs', 'memory']);
const MARKER = '<!-- dreamfeed-onboarding:v1 -->';

const TEMPLATE_DIR = path.join(__dirname, 'templates');
function template(name) {
  return fs.readFileSync(path.join(TEMPLATE_DIR, name), 'utf8');
}

const CADENCES = Object.freeze({
  'weekly-review': { title: 'Weekly Review', cadence: 'weekly', workflow: 'Weekly operating review', firstTask: 'Run the weekly review: priorities, blockers, open decisions' },
  'content': { title: 'Content', cadence: 'weekly', workflow: 'Content production', firstTask: 'Draft and publish the next content piece' },
  'outreach': { title: 'Outreach', cadence: 'weekly', workflow: 'Sales and partnership outreach', firstTask: 'Work the outreach list: follow-ups first, then new contacts' },
  'support': { title: 'Customer Support', cadence: 'daily', workflow: 'Support and success', firstTask: 'Clear the support inbox and log recurring issues' },
  'finance': { title: 'Finance', cadence: 'monthly', workflow: 'Finance operations', firstTask: 'Reconcile the books and update the runway number' },
});

const DOMAIN_AGENTS = Object.freeze({
  'content-marketing': { id: 'content-marketing', name: 'Content & Marketing Agent', output: 'marketing copy, content drafts, and campaign plans' },
  'research-intelligence': { id: 'research-intelligence', name: 'Research & Intelligence Agent', output: 'research briefs and competitive intelligence reports' },
  'sales': { id: 'sales', name: 'Sales & Partnerships Agent', output: 'outreach drafts, pipeline summaries, and partnership briefs' },
  'developer': { id: 'developer', name: 'Developer Agent', output: 'code changes, technical designs, and test reports' },
  'operations-admin': { id: 'operations-admin', name: 'Operations & Admin Agent', output: 'process documentation, schedules, and administrative artifacts' },
});

const cell = (v) => String(v === undefined || v === null ? '' : v).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

function operatorOf(answers) {
  return String(answers['q-operator-name'] || '').trim() || 'Founder';
}

function taskTable(tasks) {
  const rows = tasks.map((t) => `| ${cell(t.id)} | ${cell(t.title)} | ${cell(t.status)} | ${cell(t.est || '')} | ${cell(t.scheduled || '')} | ${cell(t.owner)} |`);
  return ['| ID | Task | Status | Est | Scheduled | Owner |', '|---|---|---|---|---|---|', ...rows].join('\n');
}

function goalContent(goal, operator, asOfDate) {
  const tasks = (goal.tasks && goal.tasks.length ? goal.tasks : [{ title: goal.firstTask || 'Define the first task' }])
    .map((t, i) => ({
      id: `T${i + 1}`,
      title: t.title,
      status: t.status || (i === 0 ? 'active' : 'planned'),
      est: t.est || '',
      scheduled: t.scheduled || (i === 0 ? asOfDate : ''),
      owner: t.owner || operator,
    }));
  return [
    '---',
    'schema: dreamfeed/v1',
    'type: goal',
    'status: active',
    `owner: ${operatorFm(operator)}`,
    ...(goal.targetDate ? [`target_date: "${goal.targetDate}"`] : []),
    `date_modified: "${asOfDate}"`,
    'generated_by: dreamfeed-onboarding/v1',
    '---',
    `# Goal: ${goal.title}`,
    '',
    `## Phase: ${goal.phase || 'Phase 1 — Prove'}`,
    '',
    `### Milestone: ${goal.milestone || 'First milestone'}`,
    '',
    taskTable(tasks),
    '',
  ].join('\n');
}

function operationContent(op, operator, asOfDate) {
  const tasks = (op.tasks && op.tasks.length ? op.tasks : [{ title: op.firstTask }])
    .map((t, i) => ({
      id: `W${i + 1}`,
      title: t.title,
      status: t.status || 'planned',
      est: t.est || '',
      scheduled: t.scheduled || (i === 0 ? asOfDate : ''),
      owner: t.owner || operator,
    }));
  return [
    '---',
    'schema: dreamfeed/v1',
    'type: operation',
    'status: active',
    `owner: ${operatorFm(operator)}`,
    `cadence: ${op.cadence || 'weekly'}`,
    `date_modified: "${asOfDate}"`,
    'generated_by: dreamfeed-onboarding/v1',
    '---',
    `# Operation: ${op.title}`,
    '',
    `## Workflow: ${op.workflow || op.title}`,
    '',
    taskTable(tasks),
    '',
  ].join('\n');
}

// Frontmatter values are the flat YAML subset — keep them single-line and
// colon-safe rather than quoting rules the parser does not implement.
function operatorFm(operator) {
  return String(operator).replace(/[:\r\n]/g, ' ').replace(/\s+/g, ' ').trim() || 'Founder';
}

function policyContent(asOfDate) {
  return [
    '---',
    'schema: dreamfeed/v1',
    'type: policy',
    `date_modified: "${asOfDate}"`,
    'generated_by: dreamfeed-onboarding/v1',
    '---',
    '# Policy',
    '',
    'Operation classes for the governed write lifecycle. `auto` is ledgered and',
    'policy-approved; `approve` needs explicit operator approval; `founder` adds',
    'typed confirmation; unknown operations are denied.',
    '',
    '| Operation | Class |',
    '|---|---|',
    '| task-transition | auto |',
    '| work-file-edit | approve |',
    '| promote-topology | approve |',
    '| scaffold-project | approve |',
    '| git-init | approve |',
    '| git-add | approve |',
    '| git-commit | approve |',
    '| git-branch | approve |',
    '| git-switch | approve |',
    '| git-push | founder |',
    '| rollback | founder |',
    '',
  ].join('\n');
}

function blockersContent(asOfDate) {
  return [
    '---',
    'schema: dreamfeed/v1',
    'type: blockers',
    `date_modified: "${asOfDate}"`,
    'generated_by: dreamfeed-onboarding/v1',
    '---',
    '# Blockers',
    '',
    '| Blocked Item | Scope | Blocking Condition | Unblocking Action |',
    '|---|---|---|---|',
    '',
  ].join('\n');
}

// Topology manifest rows for the scaffold. Nodes reflect only families being
// generated (or already present) — the map never claims files that will not
// exist. Agent-to-agent edges live in AGENT.md frontmatter (parsed directly);
// the manifest adds document/memory nodes and reads-edges.
function topologyRows(answers, families) {
  const nodes = [];
  const edges = [];
  const domainIds = (answers['q-agent-domains'] || []).map((v) => DOMAIN_AGENTS[v]).filter(Boolean).map((d) => d.id);
  if (families.includes('docs')) {
    nodes.push(
      { id: 'doc-strategy', kind: 'document', name: 'Strategy', promotedFrom: 'docs/strategy.md', matchedBy: ['onboarding'] },
      { id: 'doc-roadmap', kind: 'document', name: 'Roadmap', promotedFrom: 'docs/roadmap.md', matchedBy: ['onboarding'] },
      { id: 'doc-brand-brief', kind: 'document', name: 'Brand Brief', promotedFrom: 'docs/brand-brief.md', matchedBy: ['onboarding'] },
    );
    if (families.includes('agents')) {
      edges.push(
        { from: 'founder', type: 'reads', to: 'doc-strategy' },
        { from: 'chief-of-staff', type: 'reads', to: 'doc-roadmap' },
        ...domainIds.map((id) => ({ from: id, type: 'reads', to: 'doc-brand-brief' })),
      );
    }
  }
  if (families.includes('memory')) {
    nodes.push({ id: 'memory-store', kind: 'memory', name: 'Operating Memory', promotedFrom: 'memory/README.md', matchedBy: ['onboarding'] });
    if (families.includes('agents')) edges.push({ from: 'chief-of-staff', type: 'reads', to: 'memory-store' });
  }
  return { nodes, edges };
}

function manifestContent(nodes, edges) {
  const c = (v) => cell(v) || '—';
  const lines = [
    '---', 'definition_type: topology_manifest', 'schema: dreamfeed-topology/v1', '---', '',
    '# Topology Manifest', '',
    'Promoted through the governed lifecycle (D32/D36). Written by approved',
    'plans; edits outside the lifecycle will show as drift.', '',
    '## Nodes', '',
    '| Id | Kind | Name | Promoted From | Matched By |', '|---|---|---|---|---|',
  ];
  for (const n of nodes) lines.push(`| ${c(n.id)} | ${c(n.kind)} | ${c(n.name)} | ${c(n.promotedFrom)} | ${c((n.matchedBy || []).join(', '))} |`);
  lines.push('', '## Edges', '', '| From | Type | To |', '|---|---|---|');
  for (const e of edges) lines.push(`| ${c(e.from)} | ${c(e.type)} | ${c(e.to)} |`);
  lines.push('');
  return lines.join('\n');
}

// --- per-family file production ---------------------------------------------

function familyFiles(family, input) {
  const { answers = {}, imports = {}, families = FAMILIES, asOfDate, repoRoot } = input;
  const operator = operatorOf(answers);
  const out = []; // { path, content, provenance }

  if (family === 'os-core') {
    const goals = (imports.goals && imports.goals.length) ? imports.goals : [{
      title: String(answers['q-goal-title'] || '').trim() || 'First goal',
      milestone: String(answers['q-goal-milestone'] || '').trim(),
      firstTask: String(answers['q-goal-first-task'] || '').trim(),
      targetDate: String(answers['q-goal-target-date'] || '').trim() || undefined,
    }];
    const goalProv = ['q-goal-title', 'q-goal-milestone', 'q-goal-first-task', 'q-goal-target-date', 'q-operator-name'];
    const seen = new Set();
    for (const g of goals) {
      let slug = slugify(g.title) || 'goal';
      while (seen.has(slug)) slug = `${slug}-2`;
      seen.add(slug);
      out.push({
        path: `os/goals/${slug}.md`,
        content: goalContent(g, operator, asOfDate),
        provenance: [{ section: `Goal: ${g.title}`, questionIds: g.imported ? [] : goalProv, importedFrom: g.importedFrom }],
      });
    }
    const cadenceOps = (answers['q-cadences'] || []).map((v) => CADENCES[v]).filter(Boolean);
    const ops = (imports.operations && imports.operations.length) ? imports.operations : cadenceOps;
    const opSeen = new Set();
    for (const op of ops) {
      let slug = slugify(op.title) || 'operation';
      while (opSeen.has(slug)) slug = `${slug}-2`;
      opSeen.add(slug);
      out.push({
        path: `os/operations/${slug}.md`,
        content: operationContent(op, operator, asOfDate),
        provenance: [{ section: `Operation: ${op.title}`, questionIds: op.imported ? [] : ['q-cadences', 'q-operator-name'], importedFrom: op.importedFrom }],
      });
    }
    out.push({ path: 'os/policy.md', content: policyContent(asOfDate), provenance: [{ section: 'Policy', questionIds: [] }] });
    out.push({ path: 'os/blockers.md', content: blockersContent(asOfDate), provenance: [{ section: 'Blockers', questionIds: [] }] });
    const topo = topologyRows(answers, families);
    if (topo.nodes.length || topo.edges.length) {
      out.push({
        path: 'os/topology.md',
        content: null, // resolved in generateFamily (merge with an existing manifest)
        topo,
        provenance: [{ section: 'Topology Manifest', questionIds: ['q-agent-domains'] }],
      });
    }
    return out;
  }

  if (family === 'agents') {
    const ctxBase = { operator, date: asOfDate };
    const domains = (answers['q-agent-domains'] || []).map((v) => DOMAIN_AGENTS[v]).filter(Boolean);
    const dispatchList = domains.map((d) => `  - ${d.id}`).join('\n');
    const founder = render(template('agent-founder.md'), answers, ctxBase);
    out.push({ path: 'agents/founder/AGENT.md', content: founder.content, provenance: founder.provenance });
    const cos = render(template('agent-chief-of-staff.md'), answers, { ...ctxBase, 'dispatch-list': dispatchList });
    out.push({ path: 'agents/chief-of-staff/AGENT.md', content: cos.content, provenance: cos.provenance });
    for (const d of domains) {
      const r = render(template('agent-domain.md'), answers, { ...ctxBase, 'agent-id': d.id, 'agent-name': d.name, 'agent-output': d.output });
      out.push({ path: `agents/${d.id}/AGENT.md`, content: r.content, provenance: r.provenance.map((s) => ({ ...s, questionIds: [...new Set([...s.questionIds, 'q-agent-domains'])] })) });
    }
    return out;
  }

  if (family === 'harness') {
    const agentLabel = { 'claude-code': 'Claude Code', codex: 'Codex', cursor: 'Cursor' }[answers['q-coding-agent']];
    const ctx = {
      operator, date: asOfDate,
      'coding-agent-line': agentLabel ? `Primary coding agent: ${agentLabel}.` : '',
    };
    const claude = render(template('claude-md.md'), answers, ctx);
    out.push({ path: 'CLAUDE.md', content: claude.content, provenance: claude.provenance, mergeAppend: true });
    const agentsMd = render(template('agents-md.md'), answers, ctx);
    out.push({ path: 'AGENTS.md', content: agentsMd.content, provenance: agentsMd.provenance, mergeAppend: true });
    return out;
  }

  if (family === 'docs') {
    const ctx = { operator, date: asOfDate };
    for (const [tpl, rel] of [['strategy.md', 'docs/strategy.md'], ['roadmap.md', 'docs/roadmap.md'], ['brand-brief.md', 'docs/brand-brief.md']]) {
      const r = render(template(tpl), answers, ctx);
      out.push({ path: rel, content: r.content, provenance: r.provenance });
    }
    return out;
  }

  if (family === 'memory') {
    const ctx = { operator, date: asOfDate };
    const readme = render(template('memory-readme.md'), answers, ctx);
    out.push({ path: 'memory/README.md', content: readme.content, provenance: readme.provenance });
    out.push({ path: 'memory/memory.md', content: `# Memory Index\n\n(One line per memory file, added as they are created.)\n`, provenance: [{ section: 'Memory Index', questionIds: [] }] });
    out.push({ path: 'memory/decisions.md', content: `# Decisions\n\n| Date | Decision | Why |\n|---|---|---|\n| ${asOfDate} | Adopted the Dreamfeed operating layout | Onboarding baseline |\n`, provenance: [{ section: 'Decisions', questionIds: [] }] });
    out.push({ path: 'memory/learnings.md', content: `# Learnings\n\n(What worked, what failed, what to never repeat — date each entry.)\n`, provenance: [{ section: 'Learnings', questionIds: [] }] });
    return out;
  }

  return out;
}

// Resolve a family's file set against the CURRENT repo: existence, merge
// semantics, base hashes. Returns { files, warnings } where each file is
// { path, content, baseHash, create, family, provenance }.
function generateFamily(family, input) {
  if (!FAMILIES.includes(family)) return { error: `unknown scaffold family "${family}"`, code: 'validation' };
  const { repoRoot } = input;
  if (!repoRoot) return { error: 'no project configured', code: 'no-project' };
  const asOfDate = input.asOfDate || new Date().toISOString().slice(0, 10);
  const produced = familyFiles(family, { ...input, asOfDate });
  const files = [];
  const warnings = [];
  for (const f of produced) {
    const abs = path.join(repoRoot, f.path);
    const exists = fs.existsSync(abs);
    if (f.path === 'os/topology.md' && f.topo) {
      // Merge with whatever manifest exists (same semantics as promote-topology).
      const existing = exists ? readManifest(repoRoot) : { nodes: [], edges: [] };
      const nodes = existing.nodes.map((n) => ({
        id: n.id.value, kind: n.nodeType, name: n.name.value,
        promotedFrom: n.promoted_from && !n.promoted_from.nys ? n.promoted_from.value : '',
        matchedBy: n.matched_by && !n.matched_by.nys ? String(n.matched_by.value).split(',').map((s) => s.trim()).filter((s) => s && s !== '—') : [],
      }));
      const edges = existing.edges.map((e) => ({ from: e.from.value, type: e.type.value, to: e.to.value }));
      const nodeIds = new Set(nodes.map((n) => n.id));
      for (const n of f.topo.nodes) if (!nodeIds.has(n.id)) { nodes.push(n); nodeIds.add(n.id); }
      const key = (e) => `${e.from}|${e.type}|${e.to}`;
      const edgeKeys = new Set(edges.map(key));
      for (const e of f.topo.edges) if (!edgeKeys.has(key(e))) { edges.push(e); edgeKeys.add(key(e)); }
      const preimage = exists ? fs.readFileSync(abs, 'utf8') : null;
      files.push({ path: f.path, content: manifestContent(nodes, edges), baseHash: preimage === null ? null : hashText(preimage), create: !exists, family, provenance: f.provenance });
      continue;
    }
    if (!exists) {
      files.push({ path: f.path, content: f.content, baseHash: null, create: true, family, provenance: f.provenance });
      continue;
    }
    if (f.mergeAppend) {
      const preimage = fs.readFileSync(abs, 'utf8');
      if (preimage.includes(MARKER)) {
        warnings.push(`${f.path}: already carries a Dreamfeed onboarding section — skipped`);
        continue;
      }
      const merged = `${preimage.replace(/\s*$/, '')}\n\n${MARKER}\n\n${f.content.replace(/^---[\s\S]*?---\n/, '')}`;
      files.push({ path: f.path, content: merged, baseHash: hashText(preimage), create: false, family, provenance: f.provenance });
      continue;
    }
    warnings.push(`${f.path}: already exists — skipped (the wizard never overwrites)`);
  }
  return { files, warnings, asOfDate };
}

module.exports = { generateFamily, FAMILIES, MARKER };
