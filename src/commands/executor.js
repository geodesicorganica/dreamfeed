'use strict';
// Governed executor (D31): the only code path that applies an approved plan.
// Serial (one execution at a time), hash-revalidated at every boundary, every
// transition ledgered. Git operations run as execFile ARGUMENT ARRAYS from the
// plan's validated allowlist — arbitrary shell text is structurally impossible.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { rootToken } = require('../parse');
const { writeRepoFile, hashText } = require('../write');
const {
  applyMemoryUpsert,
  applyMemoryArchive,
  applyMemoryDelete,
  safeMemorySummary,
} = require('../memory');
const {
  applyVerificationRecordCreate,
  applyReleaseCandidateUpsert,
  applyReleaseState,
  safeVerificationSummary,
  safeReleaseSummary,
} = require('../release');
const { checkDrift } = require('./plans');
const store = require('./store');
const { appendEvent } = require('./ledger');

const GIT_SUBCOMMANDS = new Set(['add', 'commit', 'switch', 'push', 'init']);

let running = null; // serial executor: id of the in-flight execution

function approvePlan(plan, { actor = 'operator', confirm } = {}, repoRoot) {
  if (plan.status !== 'planned') return { error: `plan is ${plan.status}, not approvable`, code: 'state' };
  if (rootToken(repoRoot) !== plan.rootToken) return { error: 'project changed since plan', code: 'root-drift' };
  const d = checkDrift(plan, repoRoot);
  if (d.drifted) return { error: `source changed since plan: ${d.path}`, code: 'drift' };
  if (plan.class === 'founder' && confirm !== plan.id) {
    return { error: `founder-class operation requires typed confirmation (the plan id "${plan.id}")`, code: 'confirm-required' };
  }
  const approval = store.create('approvals', 'apr', {
    planId: plan.id, planHash: plan.planHash, class: plan.class, actor,
  });
  plan.status = 'approved';
  plan.approvalId = approval.id;
  store.put('plans', plan);
  appendEvent({ type: 'approval', actor, planId: plan.id, approvalId: approval.id, planHash: plan.planHash, class: plan.class });
  return { approval };
}

function runGit(args, repoRoot) {
  if (!GIT_SUBCOMMANDS.has(args[0])) throw new Error(`git subcommand not in write allowlist: ${args[0]}`);
  return execFileSync('git', ['--no-optional-locks', ...args], {
    cwd: repoRoot, encoding: 'utf8', timeout: 30000, windowsHide: true,
  });
}

function executePlan(plan, { actor = 'operator', health } = {}, repoRoot) {
  if (plan.status !== 'approved') return { error: `plan is ${plan.status}, not executable`, code: 'state' };
  const approval = store.get('approvals', plan.approvalId);
  if (!approval || approval.planHash !== plan.planHash) return { error: 'approval does not bind this plan', code: 'approval' };
  if (rootToken(repoRoot) !== plan.rootToken) return { error: 'project changed since plan', code: 'root-drift' };
  if (running) return { error: 'another execution is in progress', code: 'busy' };
  const d = checkDrift(plan, repoRoot);
  if (d.drifted) return { error: `source changed since approval: ${d.path}`, code: 'drift' };
  const usesGit = plan.ops.some((o) => o.type === 'git');
  // git-init is exempted from the isRepo gate BY OP NAME ONLY (D36): it is the
  // op that makes the folder a repo. Every other git op still requires one.
  if (usesGit && plan.opName !== 'git-init' && health && health.isRepo === false) {
    return { error: `git operations unavailable: ${health.safeReason || 'not a git repository'}`, code: 'unsafe' };
  }
  if (plan.opName === 'git-init' && health && health.isRepo === true) {
    return { error: 'already a git repository', code: 'state' };
  }

  const execution = store.create('executions', 'exe', {
    planId: plan.id, opName: plan.opName, status: 'executing', results: [], preimages: [], actor,
  });
  // Acquire the lock and emit the start event INSIDE the try: if the started
  // append throws (e.g. a torn ledger line from a prior crash), the finally
  // still releases `running` and persists the execution as failed. Setting the
  // lock before the try would strand it permanently on such a throw.
  try {
    running = execution.id;
    appendEvent({ type: 'execution-started', actor, executionId: execution.id, planId: plan.id, planHash: plan.planHash });
    for (let i = 0; i < plan.ops.length; i++) {
      const op = plan.ops[i];
      if (op.type === 'write-file') {
        const w = writeRepoFile(op.path, op.content, repoRoot, { baseHash: op.baseHash });
        if (w.error) throw Object.assign(new Error(w.error), { code: w.code });
        execution.preimages.push({ path: op.path, preimage: w.preimage, preimageHash: w.preimageHash, appliedHash: w.newHash });
        execution.results.push({ op: i, type: 'write-file', path: op.path, ok: true });
        appendEvent({ type: 'op-applied', actor, executionId: execution.id, op: i, kind: 'write-file', path: op.path, baseHash: op.baseHash, newHash: w.newHash });
      } else if (op.type === 'git') {
        const out = runGit(op.args, repoRoot);
        execution.results.push({ op: i, type: 'git', args: op.args, ok: true, tail: String(out).split('\n').slice(-5).join('\n') });
        appendEvent({ type: 'op-applied', actor, executionId: execution.id, op: i, kind: 'git', args: op.args });
      } else if (op.type === 'memory-upsert') {
        const out = applyMemoryUpsert({ memoryId: op.memoryId, draft: op.draft, actor }, repoRoot);
        if (out.error) throw Object.assign(new Error(out.error), { code: out.code });
        const memory = safeMemorySummary(out.memory);
        execution.results.push({ op: i, type: 'memory-upsert', ok: true, memory });
        appendEvent({ type: 'op-applied', actor, executionId: execution.id, op: i, kind: 'memory-upsert', memoryId: memory.id, memoryHash: memory.contentHash, state: memory.state });
      } else if (op.type === 'memory-archive') {
        const out = applyMemoryArchive({ memoryId: op.memoryId, actor }, repoRoot);
        if (out.error) throw Object.assign(new Error(out.error), { code: out.code });
        const memory = safeMemorySummary(out.memory);
        execution.results.push({ op: i, type: 'memory-archive', ok: true, memory });
        appendEvent({ type: 'op-applied', actor, executionId: execution.id, op: i, kind: 'memory-archive', memoryId: memory.id, memoryHash: memory.contentHash, state: memory.state });
      } else if (op.type === 'memory-delete') {
        const out = applyMemoryDelete({ memoryId: op.memoryId, actor }, repoRoot);
        if (out.error) throw Object.assign(new Error(out.error), { code: out.code });
        const memory = safeMemorySummary(out.memory);
        execution.results.push({ op: i, type: 'memory-delete', ok: true, memory });
        appendEvent({ type: 'op-applied', actor, executionId: execution.id, op: i, kind: 'memory-delete', memoryId: memory.id, memoryHash: memory.contentHash, state: memory.state });
      } else if (op.type === 'verification-record-create') {
        const out = applyVerificationRecordCreate({ draft: op.draft, actor }, repoRoot);
        if (out.error) throw Object.assign(new Error(out.error), { code: out.code });
        const record = safeVerificationSummary(out.record);
        execution.results.push({ op: i, type: 'verification-record-create', ok: true, verificationRecord: record });
        appendEvent({ type: 'op-applied', actor, executionId: execution.id, op: i, kind: 'verification-record-create', verificationRecordId: record.id, verificationHash: record.contentHash, state: record.state });
      } else if (op.type === 'release-candidate-upsert') {
        const out = applyReleaseCandidateUpsert({ releaseId: op.releaseId, draft: op.draft, actor }, repoRoot);
        if (out.error) throw Object.assign(new Error(out.error), { code: out.code });
        const release = safeReleaseSummary(out.release);
        execution.results.push({ op: i, type: 'release-candidate-upsert', ok: true, releaseCandidate: release });
        appendEvent({ type: 'op-applied', actor, executionId: execution.id, op: i, kind: 'release-candidate-upsert', releaseId: release.id, releaseHash: release.contentHash, state: release.state });
      } else if (op.type === 'release-mark-ready' || op.type === 'release-abandon' || op.type === 'release-mark-shipped') {
        const out = applyReleaseState({ releaseId: op.releaseId, state: op.nextState, actor }, repoRoot);
        if (out.error) throw Object.assign(new Error(out.error), { code: out.code });
        const release = safeReleaseSummary(out.release);
        execution.results.push({ op: i, type: op.type, ok: true, releaseCandidate: release });
        appendEvent({ type: 'op-applied', actor, executionId: execution.id, op: i, kind: op.type, releaseId: release.id, releaseHash: release.contentHash, state: release.state });
      } else {
        throw new Error(`unknown op type ${op.type}`);
      }
    }
    if (execution.status === 'executing') {
      execution.status = 'succeeded';
      appendEvent({ type: 'execution-succeeded', actor, executionId: execution.id, priorState: 'executing', resultState: 'succeeded' });
    }
  } catch (err) {
    execution.status = 'failed';
    execution.error = String(err.message || err);
    execution.errorCode = err.code || 'execution';
    appendEvent({ type: 'execution-failed', actor, executionId: execution.id, error: execution.error, priorState: 'executing', resultState: 'failed' });
  } finally {
    running = null;
    execution.endedAt = new Date().toISOString();
    store.put('executions', execution);
    plan.status = execution.status === 'succeeded' ? 'executed' : plan.status;
    store.put('plans', plan);
  }
  return { execution };
}

// Note (D31): mid-flight pause/resume/halt are deliberately NOT implemented.
// executePlan is synchronous (execFileSync/writeFileSync) and current plans are
// single-op, so a halt request could never be serviced while an execution is in
// flight — the capability requires a multi-op async executor and is deferred to
// a future decision (D32 candidate). Rollback (post-execution, founder-class)
// is the implemented override.

// Rollback: founder-class override. Only write-file ops carry preimages; the
// rollback is refused if any touched file diverged after execution (per the
// incident rules in security-and-operations.md).
function rollbackExecution(execution, { actor = 'operator', confirm } = {}, repoRoot, policy) {
  if (execution.status !== 'succeeded') return { error: `execution is ${execution.status}; only succeeded executions roll back`, code: 'state' };
  if ((policy.classes['rollback'] || 'denied') !== 'founder') return { error: 'rollback is not permitted by policy', code: 'policy-denied' };
  if (confirm !== execution.id) return { error: `rollback requires typed confirmation (the execution id "${execution.id}")`, code: 'confirm-required' };
  if (!execution.preimages.length) return { error: 'execution captured no rollback preimages (git operations do not roll back)', code: 'no-preimage' };
  for (const p of execution.preimages) {
    const abs = path.join(repoRoot, p.path);
    const current = fs.existsSync(abs) ? hashText(fs.readFileSync(abs, 'utf8')) : null;
    if (current !== p.appliedHash) {
      appendEvent({ type: 'rollback-refused', actor, executionId: execution.id, path: p.path, reason: 'source diverged after execution' });
      return { error: `refusing rollback: ${p.path} diverged after execution`, code: 'diverged' };
    }
  }
  for (const p of execution.preimages) {
    const w = writeRepoFile(p.path, p.preimage ?? '', repoRoot, { baseHash: p.appliedHash });
    if (w.error) return { error: `rollback write failed: ${w.error}`, code: w.code };
  }
  execution.status = 'rolled-back';
  store.put('executions', execution);
  appendEvent({ type: 'rollback', actor, executionId: execution.id, priorState: 'succeeded', resultState: 'rolled-back', restored: execution.preimages.map((p) => p.path) });
  return { execution };
}

module.exports = { approvePlan, executePlan, rollbackExecution };
