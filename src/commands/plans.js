'use strict';
// Plan computation (D31): resolves a declarative intent against current state
// into an exact, hash-bound operation list with a human-reviewable preview.
// Planning is PURE — it never mutates the project, the sidecar counter aside.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { rootToken, splitRow } = require('../parse');
const { hashText } = require('../write');
const { findTask, TASK_STATUS } = require('../nativeSchema');
const { classFor } = require('./policy');

// Safe named git actions (D31 step 5 scope). First token is the subcommand;
// every arg is passed as an execFile array element — never a shell string.
// force/history-rewrite flags are structurally impossible: args are built here
// and validated, not accepted from the client.
const GIT_OPS = Object.freeze({
  'git-add': { build: (p) => ['add', '--', ...(Array.isArray(p.paths) && p.paths.length ? p.paths : ['.'])] },
  'git-commit': { build: (p) => ['commit', '-m', String(p.message || '').trim()] },
  'git-branch': { build: (p) => ['switch', '-c', String(p.name || '').trim()] },
  'git-switch': { build: (p) => ['switch', String(p.name || '').trim()] },
  'git-push': { build: () => ['push'] },
});
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const SAFE_PATHSPEC = /^[^-][^\0]*$/;

// Minimal line diff for previews: LCS over lines, emitted as change hunks.
function lineDiff(before, after) {
  const a = String(before ?? '').split('\n');
  const b = String(after ?? '').split('\n');
  // Trim the common prefix and suffix first: a single-line edit collapses the
  // LCS problem to ~1×1, so the quadratic DP table is only ever allocated over
  // the genuinely-changed middle (never the whole file). `base` offsets the
  // reported line numbers back into the original coordinates.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length, endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const changes = [];
  const m = midA.length, n = midB.length;
  // Hard cap: if the changed region is still huge, emit a block replace rather
  // than allocate an O(m·n) table. Every diff this feature produces is tiny;
  // this only guards against a pathological or adversarial input.
  if (m * n > 250000) {
    for (let k = 0; k < m; k++) changes.push({ type: 'del', line: start + k + 1, text: midA[k] });
    for (let k = 0; k < n; k++) changes.push({ type: 'add', line: start + k + 1, text: midB[k] });
    return changes.slice(0, 400);
  }
  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = midA[i] === midB[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (midA[i] === midB[j]) { i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { changes.push({ type: 'del', line: start + i + 1, text: midA[i] }); i++; }
    else { changes.push({ type: 'add', line: start + j + 1, text: midB[j] }); j++; }
  }
  while (i < m) { changes.push({ type: 'del', line: start + i + 1, text: midA[i] }); i++; }
  while (j < n) { changes.push({ type: 'add', line: start + j + 1, text: midB[j] }); j++; }
  return changes.slice(0, 400);
}

function planHashOf(plan) {
  const bound = {
    intentId: plan.intentId, opName: plan.opName, class: plan.class, rootToken: plan.rootToken,
    ops: plan.ops.map((o) => ({ type: o.type, path: o.path, baseHash: o.baseHash, contentHash: o.content !== undefined ? hashText(o.content) : undefined, args: o.args })),
  };
  return crypto.createHash('sha256').update(JSON.stringify(bound), 'utf8').digest('hex');
}

// --- intent kinds ----------------------------------------------------------

function planTaskTransition(intent, repoRoot) {
  const { taskId, to } = intent.payload || {};
  if (!TASK_STATUS.includes(to)) return { error: `invalid target status "${to}"`, code: 'validation' };
  const hit = findTask(repoRoot, taskId);
  if (!hit) return { error: `task not found: ${taskId}`, code: 'not-found' };
  const lines = hit.content.split(/\r?\n/);
  const rowLine = lines[hit.line - 1];
  const cells = splitRow(rowLine);
  if (cells[0] !== hit.cells[0]) return { error: 'task row moved since lookup', code: 'drift' };
  const from = cells[2];
  cells[2] = to;
  // splitRow (parse.js) UNESCAPES `\|` → `|` inside cells, so the rebuilt row
  // must RE-ESCAPE literal pipes; otherwise a cell containing a pipe injects a
  // spurious column delimiter and corrupts the table on write-back.
  const escapeCell = (c) => String(c).replace(/\|/g, '\\|');
  lines[hit.line - 1] = `| ${cells.map(escapeCell).join(' | ')} |`;
  const eol = hit.content.includes('\r\n') ? '\r\n' : '\n';
  const newContent = lines.join(eol);
  return {
    opName: 'task-transition',
    summary: `task ${taskId}: ${from} → ${to}`,
    ops: [{ type: 'write-file', path: hit.relPath, baseHash: hashText(hit.content), content: newContent }],
    preview: { diff: lineDiff(hit.content, newContent), from, to, taskId },
  };
}

function planGit(intent) {
  const opName = intent.kind;
  const spec = GIT_OPS[opName];
  const p = intent.payload || {};
  if (opName === 'git-commit' && !String(p.message || '').trim()) return { error: 'commit message required', code: 'validation' };
  if ((opName === 'git-branch' || opName === 'git-switch') && !SAFE_REF.test(String(p.name || ''))) {
    return { error: 'invalid branch name', code: 'validation' };
  }
  if (opName === 'git-add' && Array.isArray(p.paths) && !p.paths.every((x) => typeof x === 'string' && SAFE_PATHSPEC.test(x))) {
    return { error: 'invalid pathspec', code: 'validation' };
  }
  const args = spec.build(p);
  return {
    opName,
    summary: `git ${args.join(' ')}`,
    ops: [{ type: 'git', args }],
    preview: { command: ['git', ...args].join(' ') },
  };
}

// Compute a plan for an intent. Returns { plan } or { error, code }.
function computePlan(intent, { repoRoot, policy }) {
  if (!repoRoot) return { error: 'no project configured', code: 'no-project' };
  let core;
  if (intent.kind === 'task-transition') core = planTaskTransition(intent, repoRoot);
  else if (GIT_OPS[intent.kind]) core = planGit(intent);
  else return { error: `unknown intent kind "${intent.kind}"`, code: 'validation' };
  if (core.error) return core;
  const cls = classFor(policy, core.opName);
  if (cls === 'denied') return { error: `operation "${core.opName}" is denied by policy`, code: 'policy-denied' };
  const plan = {
    intentId: intent.id,
    opName: core.opName,
    class: cls,
    rootToken: rootToken(repoRoot),
    summary: core.summary,
    ops: core.ops,
    preview: core.preview,
    status: 'planned',
  };
  plan.planHash = planHashOf(plan);
  return { plan };
}

// Drift check: recompute base hashes of every file the plan touches.
function checkDrift(plan, repoRoot) {
  for (const op of plan.ops) {
    if (op.type !== 'write-file') continue;
    const abs = path.join(repoRoot, op.path);
    const current = fs.existsSync(abs) ? hashText(fs.readFileSync(abs, 'utf8')) : null;
    if (current !== op.baseHash) return { drifted: true, path: op.path };
  }
  return { drifted: false };
}

module.exports = { computePlan, checkDrift, lineDiff, planHashOf, GIT_OPS };
