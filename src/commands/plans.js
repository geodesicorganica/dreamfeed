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
const { readManifest, MANIFEST_NODE_KINDS, MANIFEST_EDGE_TYPES } = require('../topology');
const { draftMemory, getVisibleMemory, safeMemorySummary } = require('../memory');
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
    ops: plan.ops.map((o) => ({
      type: o.type,
      path: o.path,
      baseHash: o.baseHash,
      contentHash: o.content !== undefined ? hashText(o.content) : undefined,
      args: o.args,
      memoryId: o.memoryId,
      memoryHash: o.draft ? o.draft.contentHash : o.memoryHash,
    })),
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

// D32: promote discovered candidates into the durable os/topology.md manifest.
// Create-or-merge: existing manifest rows survive; incoming rows dedupe by id
// (nodes) and from|type|to (edges). baseHash null = the manifest must not
// exist at execution (create semantics in write.js/checkDrift).
const MANIFEST_PATH = 'os/topology.md';
function renderManifest(nodes, edges) {
  const cell = (c) => String(c === undefined || c === null ? '' : c).replace(/\|/g, '\\|').trim() || '—';
  const lines = [
    '---', 'definition_type: topology_manifest', 'schema: dreamfeed-topology/v1', '---', '',
    '# Topology Manifest', '',
    'Promoted through the governed lifecycle (D32). Written by approved',
    'promote-topology plans; edits outside the lifecycle will show as drift.', '',
    '## Nodes', '',
    '| Id | Kind | Name | Promoted From | Matched By |', '|---|---|---|---|---|',
  ];
  for (const n of nodes) lines.push(`| ${cell(n.id)} | ${cell(n.kind)} | ${cell(n.name)} | ${cell(n.promotedFrom)} | ${cell((n.matchedBy || []).join(', '))} |`);
  lines.push('', '## Edges', '', '| From | Type | To |', '|---|---|---|');
  for (const e of edges) lines.push(`| ${cell(e.from)} | ${cell(e.type)} | ${cell(e.to)} |`);
  lines.push('');
  return lines.join('\n');
}
function planPromoteTopology(intent, repoRoot) {
  const p = intent.payload || {};
  const inNodes = Array.isArray(p.nodes) ? p.nodes : [];
  const inEdges = Array.isArray(p.edges) ? p.edges : [];
  if (!inNodes.length && !inEdges.length) return { error: 'nothing to promote: payload has no nodes or edges', code: 'validation' };
  for (const n of inNodes) {
    if (!n || !String(n.id || '').trim()) return { error: 'node id required', code: 'validation' };
    if (!MANIFEST_NODE_KINDS.has(n.kind)) return { error: `unknown node kind "${n.kind}"`, code: 'validation' };
  }
  for (const e of inEdges) {
    if (!e || !String(e.from || '').trim() || !String(e.to || '').trim()) return { error: 'edge from/to required', code: 'validation' };
    if (!MANIFEST_EDGE_TYPES.has(e.type)) return { error: `unknown edge type "${e.type}"`, code: 'validation' };
  }
  const abs = path.join(repoRoot, MANIFEST_PATH);
  const existingContent = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  const existing = readManifest(repoRoot);
  const nodes = existing.nodes.map((n) => ({
    id: n.id.value, kind: n.nodeType, name: n.name.value,
    promotedFrom: n.promoted_from && !n.promoted_from.nys ? n.promoted_from.value : '',
    matchedBy: n.matched_by && !n.matched_by.nys ? String(n.matched_by.value).split(',').map((s) => s.trim()).filter((s) => s && s !== '—') : [],
  }));
  const edges = existing.edges.map((e) => ({ from: e.from.value, type: e.type.value, to: e.to.value }));
  const nodeIds = new Set(nodes.map((n) => n.id));
  const promoted = [];
  for (const n of inNodes) {
    const clean = { id: String(n.id).trim(), kind: n.kind, name: String(n.name || n.id).trim(), promotedFrom: String(n.promotedFrom || '').trim(), matchedBy: Array.isArray(n.matchedBy) ? n.matchedBy.map(String) : [] };
    if (nodeIds.has(clean.id)) { const i = nodes.findIndex((x) => x.id === clean.id); nodes[i] = clean; }
    else { nodes.push(clean); nodeIds.add(clean.id); }
    promoted.push(clean.id);
  }
  const edgeKey = (e) => `${e.from}|${e.type}|${e.to}`;
  const edgeKeys = new Set(edges.map(edgeKey));
  for (const e of inEdges) {
    const clean = { from: String(e.from).trim(), type: e.type, to: String(e.to).trim() };
    if (!edgeKeys.has(edgeKey(clean))) { edges.push(clean); edgeKeys.add(edgeKey(clean)); }
  }
  const newContent = renderManifest(nodes, edges);
  return {
    opName: 'promote-topology',
    summary: `promote ${promoted.length ? promoted.join(', ') : `${inEdges.length} edge(s)`} → ${MANIFEST_PATH}${existingContent === null ? ' (create)' : ''}`,
    ops: [{ type: 'write-file', path: MANIFEST_PATH, baseHash: existingContent === null ? null : hashText(existingContent), content: newContent }],
    preview: { diff: lineDiff(existingContent || '', newContent), promoted },
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

function planMemoryUpsert(intent, repoRoot) {
  const p = intent.payload || {};
  const drafted = draftMemory(p, { repoRoot });
  if (drafted.error) return drafted;
  let existing = null;
  if (p.memoryId) {
    const found = getVisibleMemory(String(p.memoryId), repoRoot);
    if (found.error) return found;
    existing = found.memory;
  }
  return {
    opName: 'memory-upsert',
    summary: `${existing ? 'update' : 'remember'} ${drafted.memory.kind}: ${drafted.memory.title}`,
    ops: [{
      type: 'memory-upsert',
      memoryId: existing ? existing.id : null,
      baseHash: existing ? existing.contentHash : null,
      draft: drafted.memory,
    }],
    preview: { memory: drafted.memory, prior: safeMemorySummary(existing) },
  };
}

function planMemoryStateChange(intent, repoRoot, opName, nextState) {
  const memoryId = String((intent.payload || {}).memoryId || '').trim();
  if (!memoryId) return { error: 'memoryId required', code: 'validation' };
  const found = getVisibleMemory(memoryId, repoRoot);
  if (found.error) return found;
  if (found.memory.state === 'deleted-tombstone') return { error: 'deleted memory cannot be changed', code: 'state' };
  return {
    opName,
    summary: `${nextState === 'archived' ? 'archive' : 'delete'} memory ${memoryId}: ${found.memory.title}`,
    ops: [{ type: opName, memoryId, baseHash: found.memory.contentHash }],
    preview: { memory: safeMemorySummary(found.memory), nextState },
  };
}

// Compute a plan for an intent. Returns { plan } or { error, code }.
function computePlan(intent, { repoRoot, policy }) {
  if (!repoRoot) return { error: 'no project configured', code: 'no-project' };
  let core;
  if (intent.kind === 'task-transition') core = planTaskTransition(intent, repoRoot);
  else if (intent.kind === 'promote-topology') core = planPromoteTopology(intent, repoRoot);
  else if (intent.kind === 'memory-upsert') core = planMemoryUpsert(intent, repoRoot);
  else if (intent.kind === 'memory-archive') core = planMemoryStateChange(intent, repoRoot, 'memory-archive', 'archived');
  else if (intent.kind === 'memory-delete') core = planMemoryStateChange(intent, repoRoot, 'memory-delete', 'deleted-tombstone');
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
  for (const op of plan.ops) {
    if (!op.type || !op.type.startsWith('memory-') || !op.memoryId) continue;
    const current = getVisibleMemory(op.memoryId, repoRoot);
    if (current.error) return { drifted: true, path: op.memoryId };
    if (current.memory.contentHash !== op.baseHash) return { drifted: true, path: op.memoryId };
  }
  return { drifted: false };
}

module.exports = { computePlan, checkDrift, lineDiff, planHashOf, GIT_OPS };
