'use strict';
// Dreamfeed-native schema adapter family (D31; spec: docs/product/native-schema.md).
// Additional adapter family beside the Gate C six — Gate C semantics untouched.
// Same provenance discipline: field()/nys() tiers on every rendered field;
// degradation never throws.

const fs = require('fs');
const path = require('path');
const {
  parseFile, extractTables, field, nys, computeFreshness, slugify,
} = require('./parse');

const TASK_STATUS = ['planned', 'active', 'done', 'blocked'];
const TASK_HEADERS = ['ID', 'Task', 'Status', 'Est', 'Scheduled', 'Owner'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const GOALS_DIR = 'os/goals';
const OPERATIONS_DIR = 'os/operations';

function hasNativeSchema(repoRoot) {
  try {
    return fs.existsSync(path.join(repoRoot, GOALS_DIR)) ||
      fs.existsSync(path.join(repoRoot, OPERATIONS_DIR));
  } catch { return false; }
}

function listDirFiles(repoRoot, rel) {
  try {
    return fs.readdirSync(path.join(repoRoot, rel))
      .filter((n) => n.endsWith('.md'))
      .sort()
      .map((n) => `${rel}/${n}`);
  } catch { return []; }
}

function parseEst(text) {
  // "2h" / "30m" / "1.5h" → hours; anything else degrades.
  const m = String(text || '').trim().match(/^(\d+(?:\.\d+)?)\s*(h|m)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2].toLowerCase() === 'm' ? n / 60 : n;
}

// Shared task-row adapter. containerId scopes the global task id; chain is the
// intact parent path preserved for the queue projection and the Inspector.
function adaptTaskRow(row, file, containerId, chain, freshness) {
  const c = row.cells;
  if (c.length < 6) {
    return { error: { path: file.path, error: `task row at line ${row.line} has ${c.length} cells, expected 6` } };
  }
  const status = c[2].trim().toLowerCase();
  const est = parseEst(c[3]);
  const scheduled = c[4].trim();
  return {
    task: {
      objectType: 'task',
      id: field(`${containerId}:${c[0]}`, 'Derived'),
      localId: field(c[0], 'Canonical'),
      title: field(c[1], 'Canonical'),
      status: TASK_STATUS.includes(status) ? field(status, 'Canonical') : nys('Canonical'),
      est_hours: est !== null ? field(est, 'Derived') : nys('Derived'),
      scheduled: ISO_DATE.test(scheduled) ? field(scheduled, 'Canonical') : nys('Canonical'),
      owner: c[5] ? field(c[5], 'Canonical') : nys('Canonical'),
      chain: field(chain, 'Derived'),
      freshness,
      source_evidence: field({ file: file.path, locator: `task ${c[0]} (line ${row.line})` }, 'Derived'),
    },
  };
}

// Parses one goal or operation file. sectionRe distinguishes the two shapes:
// goals use "## Phase:" + "### Milestone:", operations use "## Workflow:".
function parseWorkFile(repoRoot, relPath, kind, thresholds, today) {
  const file = parseFile(path.join(repoRoot, relPath), repoRoot);
  const errors = [];
  if (file.error) return { object: null, errors: [{ path: relPath, error: file.error }] };
  const fm = file.frontmatter || {};
  const slug = path.basename(relPath, '.md');
  const freshness = computeFreshness(fm, thresholds, today);
  const lines = file.content.split(/\r?\n/);

  const titleLine = lines.find((l) => /^#\s+/.test(l));
  const title = titleLine ? titleLine.replace(/^#\s+(Goal:|Operation:)?\s*/i, '').trim() : slug;

  // Walk the section structure, attributing each table to its enclosing
  // section(s) by line number.
  const tables = extractTables(file.content);
  const sections = []; // goals: {phase, milestone, line}; operations: {workflow, line}
  lines.forEach((line, i) => {
    const h2 = line.match(/^##\s+(Phase|Workflow):\s*(.+)$/i);
    const h3 = line.match(/^###\s+Milestone:\s*(.+)$/i);
    if (h2) sections.push({ level: 2, label: h2[1].toLowerCase(), title: h2[2].trim(), line: i + 1 });
    if (h3) sections.push({ level: 3, label: 'milestone', title: h3[1].trim(), line: i + 1 });
  });
  const enclosing = (tableLine, level, label) => {
    let found = null;
    for (const s of sections) {
      if (s.line < tableLine && s.level === level && s.label === label) found = s;
      if (s.line >= tableLine) break;
    }
    return found;
  };

  const containers = []; // goals: phases[]; operations: workflows[]
  const byTitle = new Map();
  for (const t of tables) {
    if (!TASK_HEADERS.every((h) => t.headers.some((th) => th.toLowerCase().includes(h.toLowerCase())))) continue;
    let phase = null, group = null;
    if (kind === 'goal') {
      phase = enclosing(t.headerLine, 2, 'phase');
      group = enclosing(t.headerLine, 3, 'milestone');
      if (!phase || !group) { errors.push({ path: relPath, error: `task table at line ${t.headerLine} is not under a Phase/Milestone` }); continue; }
    } else {
      group = enclosing(t.headerLine, 2, 'workflow');
      if (!group) { errors.push({ path: relPath, error: `task table at line ${t.headerLine} is not under a Workflow` }); continue; }
    }
    const tasks = [];
    for (const row of t.rows) {
      const chain = kind === 'goal'
        ? { goal: title, phase: phase.title, milestone: group.title }
        : { operation: title, workflow: group.title };
      const r = adaptTaskRow(row, file, slug, chain, freshness);
      if (r.error) errors.push(r.error); else tasks.push(r.task);
    }
    if (kind === 'goal') {
      let ph = byTitle.get(phase.title);
      if (!ph) { ph = { title: field(phase.title, 'Canonical'), milestones: [] }; byTitle.set(phase.title, ph); containers.push(ph); }
      ph.milestones.push({ title: field(group.title, 'Canonical'), tasks });
    } else {
      containers.push({ title: field(group.title, 'Canonical'), tasks });
    }
  }

  const base = {
    objectType: kind,
    id: field(slug, 'Canonical'),
    title: field(title, 'Canonical'),
    status: fm.status ? field(fm.status, 'Canonical') : nys('Canonical'),
    owner: fm.owner ? field(fm.owner, 'Canonical') : nys('Canonical'),
    sprint_week: fm.sprint_week ? field(fm.sprint_week, 'Canonical') : nys('Canonical'),
    freshness,
    source_evidence: field({ file: relPath, locator: `${kind} ${slug}` }, 'Derived'),
  };
  if (kind === 'goal') {
    base.target_date = fm.target_date ? field(fm.target_date, 'Canonical') : nys('Canonical');
    base.phases = containers;
  } else {
    base.cadence = fm.cadence ? field(fm.cadence, 'Canonical') : nys('Canonical');
    base.workflows = containers;
  }
  return { object: base, errors };
}

// Blockers (optional os/blockers.md) — mirrors the blocked_items table shape.
function parseBlockers(repoRoot, thresholds, today) {
  const rel = 'os/blockers.md';
  if (!fs.existsSync(path.join(repoRoot, rel))) return { blockers: [], errors: [] };
  const file = parseFile(path.join(repoRoot, rel), repoRoot);
  if (file.error) return { blockers: [], errors: [{ path: rel, error: file.error }] };
  const freshness = computeFreshness(file.frontmatter || {}, thresholds, today);
  const tables = extractTables(file.content);
  const t = tables.find((tb) => tb.headers.some((h) => /blocked/i.test(h)));
  if (!t) return { blockers: [], errors: [] };
  const blockers = t.rows.filter((r) => r.cells.length >= 3).map((r) => ({
    objectType: 'blocker',
    id: field(`blocker-${slugify(r.cells[0])}`, 'Derived'),
    item: field(r.cells[0], 'Canonical'),
    scope: field(r.cells[1], 'Canonical'),
    condition: field(r.cells[2], 'Canonical'),
    unblocking_action: r.cells[3] ? field(r.cells[3], 'Canonical') : nys('Canonical'),
    freshness,
    source_evidence: field({ file: rel, locator: `blocker row (line ${r.line})` }, 'Derived'),
  }));
  return { blockers, errors: [] };
}

// Full native-state build. Pull architecture: re-reads sources on every call,
// never caches (same discipline as buildState).
function buildNativeState({ repoRoot, today = new Date(), thresholds = {} } = {}) {
  const errors = [];
  const goals = [];
  const operations = [];
  if (!repoRoot || !hasNativeSchema(repoRoot)) {
    return { hasNative: false, goals, operations, blockers: [], parseErrors: errors };
  }
  for (const rel of listDirFiles(repoRoot, GOALS_DIR)) {
    const r = parseWorkFile(repoRoot, rel, 'goal', thresholds, today);
    if (r.object) goals.push(r.object);
    errors.push(...r.errors);
  }
  for (const rel of listDirFiles(repoRoot, OPERATIONS_DIR)) {
    const r = parseWorkFile(repoRoot, rel, 'operation', thresholds, today);
    if (r.object) operations.push(r.object);
    errors.push(...r.errors);
  }
  const b = parseBlockers(repoRoot, thresholds, today);
  errors.push(...b.errors);
  return { hasNative: true, goals, operations, blockers: b.blockers, parseErrors: errors };
}

// Locate a task by global id ("<file-slug>:<localId>") for the write engine.
// Returns the source file, table row line, and current row cells — enough for
// a plan to compute an exact single-line rewrite with drift detection.
function findTask(repoRoot, taskId) {
  const [slug, localId] = String(taskId).split(':');
  if (!slug || !localId) return null;
  for (const [dir, kind] of [[GOALS_DIR, 'goal'], [OPERATIONS_DIR, 'operation']]) {
    const rel = `${dir}/${slug}.md`;
    if (!fs.existsSync(path.join(repoRoot, rel))) continue;
    const file = parseFile(path.join(repoRoot, rel), repoRoot);
    if (file.error) return null;
    for (const t of extractTables(file.content)) {
      if (!TASK_HEADERS.every((h) => t.headers.some((th) => th.toLowerCase().includes(h.toLowerCase())))) continue;
      for (const row of t.rows) {
        if (row.cells[0] === localId) {
          return { kind, relPath: rel, line: row.line, cells: row.cells, content: file.content };
        }
      }
    }
  }
  return null;
}

module.exports = {
  TASK_STATUS, hasNativeSchema, buildNativeState, findTask,
  GOALS_DIR, OPERATIONS_DIR,
};
