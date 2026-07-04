'use strict';
// Policy classes (D31): auto | approve | founder | denied. Loaded from the
// selected project's os/policy.md when present; app defaults otherwise.
// Unknown operations are DENIED — new write capabilities must be explicitly
// classed before they are plannable.

const fs = require('fs');
const path = require('path');
const { parseFile, findTable } = require('../parse');

const CLASSES = new Set(['auto', 'approve', 'founder', 'denied']);

const DEFAULTS = Object.freeze({
  'task-transition': 'auto',
  'work-file-edit': 'approve',
  'git-add': 'approve',
  'git-commit': 'approve',
  'git-branch': 'approve',
  'git-switch': 'approve',
  'git-push': 'founder',
  'rollback': 'founder',
});

function loadPolicy(repoRoot) {
  const classes = { ...DEFAULTS };
  const rel = 'os/policy.md';
  if (!repoRoot || !fs.existsSync(path.join(repoRoot, rel))) {
    return { classes, source: 'defaults' };
  }
  const file = parseFile(path.join(repoRoot, rel), repoRoot);
  if (file.error) return { classes, source: 'defaults', warning: `policy unreadable: ${file.error}` };
  const table = findTable(file.content, ['Operation', 'Class']);
  if (!table) return { classes, source: 'defaults', warning: 'policy table not found' };
  for (const row of table.rows) {
    const [op, cls] = row.cells.map((c) => c.trim().toLowerCase());
    if (!op) continue;
    // A project may only re-class known operations; it cannot invent new ones,
    // and an invalid class degrades to denied (never to a weaker class).
    if (!(op in DEFAULTS)) continue;
    classes[op] = CLASSES.has(cls) ? cls : 'denied';
  }
  return { classes, source: rel };
}

function classFor(policy, opName) {
  return policy.classes[opName] || 'denied';
}

module.exports = { loadPolicy, classFor, DEFAULTS, CLASSES };
