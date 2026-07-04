'use strict';
// Goal C — Repo Health. READ-ONLY git inspection + read-only audit-status read.
// Runs only non-destructive git reads (rev-parse, status, log, rev-list) with
// --no-optional-locks. NEVER runs commit/push/reset/checkout/clean/add. Reads the
// audit-status sidecar written by the repo-harness-auditor harness
// (audit.js at the repo root) — it never writes that file. Zero write-back to
// any governance/content source file (NFR1).

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { REPO_ROOT, canonicalKey, rootToken } = require('./parse');

const READONLY_SUBCOMMANDS = new Set(['rev-parse', 'status', 'log', 'rev-list']);
const AUDIT_STATUS_FILE = path.join(__dirname, '..', 'audit-status.json');

function git(args, cwd = REPO_ROOT) {
  if (!READONLY_SUBCOMMANDS.has(args[0])) throw new Error(`repohealth: refused non-read-only git subcommand "${args[0]}"`);
  return execFileSync('git', ['--no-optional-locks', ...args], { cwd, encoding: 'utf8', timeout: 5000, windowsHide: true }).trim();
}
function tryGit(args, cwd = REPO_ROOT) {
  try { return { ok: true, out: git(args, cwd) }; }
  catch (err) { return { ok: false, out: null, error: String(err.message || err).split('\n')[0] }; }
}

function ageLabel(iso, now) {
  if (!iso) return null;
  const ms = now - new Date(iso).getTime();
  if (isNaN(ms)) return null;
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just updated';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// The repo-harness-auditor canonical audit workflow + concrete check harness.
const AUDIT_WORKFLOW = {
  skill: 'repo-harness-auditor',
  skillPurpose: 'read-only agentic-SDLC / repo-readiness audit (run via the repo-harness-auditor skill)',
  harness: 'node audit.js',
  harnessPurpose: 'concrete read-only check harness (governance validators + cockpit tests + git snapshot) — writes audit-status.json that this panel reads',
};

function readAudit(now, lastCommitIso, clean, repoRoot, auditConfigured, sidecar) {
  if (!auditConfigured) return { everRun: false, auditConfigured: false, workflow: AUDIT_WORKFLOW };
  if (!sidecar) return { everRun: false, auditConfigured: true, workflow: AUDIT_WORKFLOW };
  const rec = sidecar;

  // Defensive: if the sidecar was stamped for a different root, do not display it.
  if (rec.repoRoot && repoRoot && rec.repoRoot !== canonicalKey(repoRoot)) {
    return { everRun: false, auditConfigured: true, workflow: AUDIT_WORKFLOW };
  }

  // Freshness model (item B3): the audit is "stale" if the repo changed since it ran
  // (working tree dirty, or a commit landed after the audit timestamp).
  const ranAt = rec.generatedAt || null;
  let freshness = 'current';
  if (clean === false) freshness = 'stale';
  else if (lastCommitIso && ranAt && new Date(lastCommitIso).getTime() > new Date(ranAt).getTime()) freshness = 'stale';
  if (!ranAt) freshness = 'unknown';

  return {
    everRun: true,
    auditConfigured: true,
    workflow: AUDIT_WORKFLOW,
    lastRun: ranAt,
    lastRunLabel: ageLabel(ranAt, now),
    freshness,                 // current | stale | unknown
    overall: rec.overall || null,
    git: rec.git || null,
    commands: Array.isArray(rec.commands) ? rec.commands.map(c => ({
      label: c.label, command: c.command, cwd: c.cwd,
      status: c.status, exitCode: c.exitCode, durationMs: c.durationMs,
      ranAt, ranAtLabel: ageLabel(ranAt, now),
      source: 'repo-harness-auditor (audit.js)',
      currency: freshness,     // current/stale — repo changed since the run
      tail: c.tail || null,
    })) : [],
  };
}

// Reference list of checks (item B3 status model). When the audit has never run,
// each shows "never-run"; otherwise the audit fills in status + timestamp + source.
function neverRunCommands() {
  return [
    { label: 'governance frontmatter validation', command: 'node tools/governance-migration/validate.js', status: 'never-run', ranAt: null, ranAtLabel: null, source: 'repo-harness-auditor (audit.js)', currency: 'never-run' },
    { label: 'governance schema fixtures', command: 'node tools/governance-migration/test-fixtures.js', status: 'never-run', ranAt: null, ranAtLabel: null, source: 'repo-harness-auditor (audit.js)', currency: 'never-run' },
    { label: 'cockpit tests', command: 'npm test', status: 'never-run', ranAt: null, ranAtLabel: null, source: 'repo-harness-auditor (audit.js)', currency: 'never-run' },
  ];
}

function getRepoHealth(repoRoot = REPO_ROOT) {
  if (!repoRoot) {
    return {
      configured: false, readOnly: true, inspectedAt: new Date().toISOString(),
      isRepo: false, rootToken: null, auditConfigured: false, branch: null, clean: null,
      counts: { staged: 0, unstaged: 0, untracked: 0 },
      lastCommit: null, upstream: { exists: false, ahead: null, behind: null },
      safeToProceed: null, safeReason: 'no project configured', errors: [],
      writeReadiness: noRepoReadiness('no project configured'),
      audit: { everRun: false, auditConfigured: false, workflow: AUDIT_WORKFLOW },
      validationCommands: [],
    };
  }
  const now = Date.now();
  // Read the sidecar once; derive auditConfigured from it (sidecar-driven model).
  let sidecar = null;
  try { sidecar = JSON.parse(fs.readFileSync(AUDIT_STATUS_FILE, 'utf8')); } catch { /* no sidecar */ }
  const auditConfigured = !!(sidecar &&
    sidecar.overall !== 'unavailable' &&
    sidecar.repoRoot && sidecar.repoRoot === canonicalKey(repoRoot));
  const result = {
    readOnly: true, inspectedAt: new Date(now).toISOString(), isRepo: true,
    rootToken: rootToken(repoRoot),
    auditConfigured,
    branch: null, clean: null, counts: { staged: 0, unstaged: 0, untracked: 0 },
    lastCommit: null, upstream: { exists: false, ahead: null, behind: null },
    safeToProceed: null, safeReason: null, errors: [],
    audit: null, validationCommands: [],
  };

  const branch = tryGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot);
  if (!branch.ok) {
    result.isRepo = false; result.errors.push(`branch: ${branch.error}`);
    result.safeToProceed = false; result.safeReason = 'not a git repository (or git unavailable)';
    result.writeReadiness = noRepoReadiness(result.safeReason);
    result.audit = readAudit(now, null, null, repoRoot, auditConfigured, sidecar);
    result.validationCommands = result.audit.everRun ? result.audit.commands : (auditConfigured ? neverRunCommands() : []);
    return result;
  }
  result.branch = branch.out;

  const status = tryGit(['status', '--porcelain=v1'], repoRoot);
  if (status.ok) {
    const lines = status.out ? status.out.split('\n').filter(Boolean) : [];
    for (const line of lines) {
      if (line.startsWith('??')) { result.counts.untracked++; continue; }
      if (line[0] && line[0] !== ' ' && line[0] !== '?') result.counts.staged++;
      if (line[1] && line[1] !== ' ' && line[1] !== '?') result.counts.unstaged++;
    }
    result.clean = lines.length === 0;
  } else { result.errors.push(`status: ${status.error}`); }

  const log = tryGit(['log', '-1', '--format=%h%x1f%s%x1f%an%x1f%aI'], repoRoot);
  if (log.ok && log.out) {
    const [hash, subject, author, isoDate] = log.out.split('\x1f');
    result.lastCommit = { hash, subject, author, date: isoDate, dateLabel: ageLabel(isoDate, now) };
  } else if (!log.ok) { result.errors.push(`log: ${log.error}`); }

  const upstreamRef = tryGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], repoRoot);
  if (upstreamRef.ok && upstreamRef.out) {
    result.upstream.exists = true; result.upstream.name = upstreamRef.out;
    const counts = tryGit(['rev-list', '--count', '--left-right', '@{upstream}...HEAD'], repoRoot);
    if (counts.ok && counts.out) {
      const m = counts.out.split(/\s+/);
      result.upstream.behind = parseInt(m[0], 10);
      result.upstream.ahead = parseInt(m[1], 10);
    }
  }

  if (result.clean === true) { result.safeToProceed = true; result.safeReason = 'working tree clean'; }
  else if (result.clean === false) {
    result.safeToProceed = false;
    const parts = [];
    if (result.counts.staged) parts.push(`${result.counts.staged} staged`);
    if (result.counts.unstaged) parts.push(`${result.counts.unstaged} unstaged`);
    if (result.counts.untracked) parts.push(`${result.counts.untracked} untracked`);
    result.safeReason = `uncommitted changes present (${parts.join(', ')}) — review before destructive actions`;
  } else { result.safeReason = 'git status unavailable'; }

  result.writeReadiness = computeWriteReadiness(result);
  result.audit = readAudit(now, result.lastCommit && result.lastCommit.date, result.clean, repoRoot, auditConfigured, sidecar);
  result.validationCommands = result.audit.everRun ? result.audit.commands : (auditConfigured ? neverRunCommands() : []);
  return result;
}

// ---------------------------------------------------------------------------
// Gate G (D31 step 5): per-operation readiness for the SAFE NAMED git actions.
// This module stays read-only — it only *judges* readiness; the governed
// executor performs the operations. Note the verdicts are op-specific because
// a blanket "clean tree" gate is wrong for writes: commit REQUIRES a dirty
// tree, while switch prefers a clean one.
// ---------------------------------------------------------------------------
function noRepoReadiness(reason) {
  const off = { ok: false, reason };
  return { gitAdd: off, gitCommit: off, gitBranch: off, gitSwitch: off, gitPush: off };
}

function computeWriteReadiness(r) {
  if (!r.isRepo) return noRepoReadiness(r.safeReason || 'not a git repository');
  const dirtyUnstaged = r.counts.unstaged + r.counts.untracked;
  return {
    gitAdd: dirtyUnstaged > 0
      ? { ok: true, reason: `${dirtyUnstaged} file(s) to stage` }
      : { ok: false, reason: 'nothing to stage' },
    gitCommit: r.counts.staged > 0
      ? { ok: true, reason: `${r.counts.staged} file(s) staged` }
      : { ok: false, reason: 'nothing staged' },
    gitBranch: { ok: true, reason: `from ${r.branch}` },
    gitSwitch: r.clean
      ? { ok: true, reason: 'working tree clean' }
      : { ok: true, warning: 'uncommitted changes may block or carry over on switch', reason: 'tree dirty' },
    gitPush: !r.upstream.exists
      ? { ok: false, reason: 'no upstream configured' }
      : (r.upstream.ahead > 0
        ? { ok: true, reason: `${r.upstream.ahead} commit(s) ahead` }
        : { ok: false, reason: 'nothing to push' }),
  };
}

module.exports = { getRepoHealth, READONLY_SUBCOMMANDS, AUDIT_STATUS_FILE };
