'use strict';
// D36 governed-import draft builders (read-only). Turn what a brownfield repo
// ALREADY declares — Stakeport-family initiative/work-item tables, roadmap
// prose, discovery evidence — into pre-filled Goal/Operation/roadmap drafts
// for the wizard. Every draft carries `importedFrom` + `matchedBy` evidence;
// nothing here writes or renders as truth: the founder edits and approves, and
// only then do os/ files exist (never silent heuristic dashboards).

const fs = require('fs');
const path = require('path');
const { buildState } = require('../state');
const { buildRoadmap } = require('../topology');
const { discover } = require('../discovery');

const val = (f, fallback = '') => (f && !f.nys && f.value !== undefined && f.value !== null ? f.value : fallback);

// Stakeport work-item statuses → native task statuses. Unknown → planned
// (never invent progress).
function taskStatus(raw) {
  const s = String(raw || '').toLowerCase();
  if (s === 'done' || s === 'shipped' || s === 'complete') return 'done';
  if (s === 'blocked') return 'blocked';
  if (s === 'now' || s === 'active' || s === 'in-progress' || s === 'doing') return 'active';
  return 'planned';
}

function goalDrafts(state) {
  const goals = [];
  for (const o of state.strategicInitiatives || []) {
    const title = String(val(o.name)).trim();
    if (!title) continue;
    const status = String(val(o.status)).toLowerCase();
    if (status === 'done' || status === 'retired' || status === 'archived') continue;
    const id = val(o.id);
    const tasks = (state.workItems || [])
      .filter((w) => val(w.initiative_link) === id || val(w.initiative) === title)
      .map((w) => ({
        title: String(val(w.action)).trim(),
        status: taskStatus(val(w.status)),
        est: String(val(w.estimate, '')).trim(),
        owner: String(val(w.owner, '')).trim() || undefined,
      }))
      .filter((t) => t.title);
    const src = val(o.source_evidence, {});
    goals.push({
      title,
      milestone: String(val(o.success_definition)).trim() || 'First milestone',
      tasks,
      imported: true,
      importedFrom: src.file || 'strategic initiatives',
      matchedBy: ['stakeport:strategic_initiatives', ...(tasks.length ? ['stakeport:work_items'] : [])],
    });
  }
  return goals;
}

function operationDrafts(discovery) {
  // Conservative v1: only markdown docs whose name/evidence says "workflow",
  // "cadence", or "operations" become Operation drafts — CI/build manifests
  // (package.json, .github/workflows) stay out; they are not business cadences.
  const ops = [];
  const seen = new Set();
  for (const c of discovery.candidates || []) {
    if (c.kind !== 'workflow') continue;
    const p = String(c.sourcePath || '');
    if (!p.endsWith('.md')) continue;
    const base = path.basename(p, '.md');
    const title = base.replace(/[-_]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()).trim();
    if (!title || seen.has(title)) continue;
    seen.add(title);
    ops.push({
      title,
      cadence: 'weekly',
      workflow: title,
      firstTask: `Run "${title}" once through the cockpit and confirm the steps`,
      imported: true,
      importedFrom: p,
      matchedBy: c.matchedBy || ['discovery:workflow'],
    });
  }
  return ops;
}

function roadmapPhaseDrafts(state) {
  return (state.roadmap || []).map((r) => ({
    label: String(val(r.phase_label)).trim(),
    scope: String(val(r.scope_summary)).trim(),
    importedFrom: val(r.source_evidence, {}).file || 'CLAUDE.md',
    matchedBy: ['roadmap:phase-sequencing'],
  })).filter((p) => p.label);
}

// Prefills: answers the interview can start from (always editable, never
// skipped past silently — the wizard shows the evidence line under each).
function prefillAnswers(repoRoot, goals) {
  const answers = {};
  const evidence = {};
  const name = path.basename(repoRoot) || '';
  if (name) {
    answers['q-business-name'] = name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
    evidence['q-business-name'] = 'folder name';
  }
  // Generic-repo signal (universal pass 2026-07-12): a manifest description
  // often answers the one-liner question verbatim. The business NAME stays the
  // folder name — package names are frequently boilerplate ("react-example")
  // while folders are user-chosen. Evidence-lined, editable.
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    if (pkg && typeof pkg.description === 'string' && pkg.description.trim()) {
      answers['q-one-liner'] = pkg.description.trim();
      evidence['q-one-liner'] = 'package.json description';
    }
  } catch { /* no manifest — folder name stands */ }
  const g = goals[0];
  if (g) {
    answers['q-goal-title'] = g.title;
    evidence['q-goal-title'] = g.importedFrom;
    if (g.milestone) { answers['q-goal-milestone'] = g.milestone; evidence['q-goal-milestone'] = g.importedFrom; }
    const firstOpen = (g.tasks || []).find((t) => t.status !== 'done');
    if (firstOpen) { answers['q-goal-first-task'] = firstOpen.title; evidence['q-goal-first-task'] = g.importedFrom; }
  }
  return { answers, evidence };
}

// Full import snapshot for /api/onboarding. Read-only; parse errors inside the
// sources degrade to fewer drafts, never to a thrown error.
function buildImports(repoRoot) {
  let state;
  try { state = buildState({ repoRoot }); }
  catch { state = { strategicInitiatives: [], workItems: [], roadmap: [] }; }
  let discovery;
  try { discovery = discover(repoRoot); }
  catch { discovery = { candidates: [] }; }
  const goals = goalDrafts(state);
  const operations = operationDrafts(discovery);
  const roadmapPhases = roadmapPhaseDrafts(state);
  const prefills = prefillAnswers(repoRoot, goals);
  return {
    goals,
    operations,
    roadmapPhases,
    prefills,
    discoverySummary: {
      candidates: (discovery.candidates || []).length,
      byKind: (discovery.candidates || []).reduce((acc, c) => { acc[c.kind] = (acc[c.kind] || 0) + 1; return acc; }, {}),
    },
  };
}

module.exports = { buildImports, goalDrafts, operationDrafts, roadmapPhaseDrafts };
