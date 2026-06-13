'use strict';
// Goal C — Repo Health. READ-ONLY git inspection only. Runs exclusively
// non-destructive plumbing/porcelain reads (rev-parse, status, log, rev-list)
// with --no-optional-locks so no index lock is taken. NEVER runs commit, push,
// reset, checkout, clean, add, or any state-changing git command. Writes zero
// bytes to any governance/content source file (NFR1) — git reads do not touch
// tracked working-tree files.

const { execFileSync } = require('child_process');
const { REPO_ROOT } = require('./parse');

// Hard allowlist: only these git subcommands may ever run from this module.
const READONLY_SUBCOMMANDS = new Set(['rev-parse', 'status', 'log', 'rev-list']);

function git(args) {
  if (!READONLY_SUBCOMMANDS.has(args[0])) {
    // Defensive: refuse anything not on the read-only allowlist.
    throw new Error(`repohealth: refused non-read-only git subcommand "${args[0]}"`);
  }
  return execFileSync('git', ['--no-optional-locks', ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 5000,
    windowsHide: true,
  }).trim();
}

function tryGit(args) {
  try { return { ok: true, out: git(args) }; }
  catch (err) { return { ok: false, out: null, error: String(err.message || err).split('\n')[0] }; }
}

function getRepoHealth() {
  const result = {
    readOnly: true,
    inspectedAt: new Date().toISOString(),
    isRepo: true,
    branch: null,
    clean: null,
    counts: { staged: 0, unstaged: 0, untracked: 0 },
    lastCommit: null,
    upstream: { exists: false, ahead: null, behind: null },
    safeToProceed: null,
    safeReason: null,
    errors: [],
    // Static reference list: the cockpit is read-only and does not execute or
    // persist test runs, so "latest observed status" is not tracked here.
    validationCommands: [
      { command: 'npm test', cwd: 'tools/command-center', purpose: 'cockpit unit + integration tests', lastObserved: 'not tracked (run manually)' },
      { command: 'node tools/governance-migration/validate.js', cwd: '<repo root>', purpose: 'governance frontmatter validation', lastObserved: 'not tracked (run manually)' },
      { command: 'node tools/governance-migration/test-fixtures.js', cwd: '<repo root>', purpose: 'governance schema fixtures', lastObserved: 'not tracked (run manually)' },
    ],
  };

  const branch = tryGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (!branch.ok) {
    result.isRepo = false;
    result.errors.push(`branch: ${branch.error}`);
    result.safeToProceed = false;
    result.safeReason = 'not a git repository (or git unavailable)';
    return result;
  }
  result.branch = branch.out;

  const status = tryGit(['status', '--porcelain=v1']);
  if (status.ok) {
    const lines = status.out ? status.out.split('\n').filter(Boolean) : [];
    for (const line of lines) {
      const x = line[0]; // index (staged) status
      const y = line[1]; // worktree (unstaged) status
      if (line.startsWith('??')) { result.counts.untracked++; continue; }
      if (x && x !== ' ' && x !== '?') result.counts.staged++;
      if (y && y !== ' ' && y !== '?') result.counts.unstaged++;
    }
    result.clean = lines.length === 0;
  } else {
    result.errors.push(`status: ${status.error}`);
  }

  const log = tryGit(['log', '-1', '--format=%h%x1f%s%x1f%an%x1f%aI']);
  if (log.ok && log.out) {
    const [hash, subject, author, isoDate] = log.out.split('\x1f');
    result.lastCommit = { hash, subject, author, date: isoDate };
  } else if (!log.ok) {
    result.errors.push(`log: ${log.error}`);
  }

  // Ahead/behind only when an upstream is configured.
  const upstreamRef = tryGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
  if (upstreamRef.ok && upstreamRef.out) {
    result.upstream.exists = true;
    result.upstream.name = upstreamRef.out;
    const counts = tryGit(['rev-list', '--count', '--left-right', '@{upstream}...HEAD']);
    if (counts.ok && counts.out) {
      const m = counts.out.split(/\s+/);
      result.upstream.behind = parseInt(m[0], 10);
      result.upstream.ahead = parseInt(m[1], 10);
    }
  }

  // "Safe to proceed" heuristic — advisory only, never an action.
  if (result.clean === true) {
    result.safeToProceed = true;
    result.safeReason = 'working tree clean';
  } else if (result.clean === false) {
    result.safeToProceed = false;
    const parts = [];
    if (result.counts.staged) parts.push(`${result.counts.staged} staged`);
    if (result.counts.unstaged) parts.push(`${result.counts.unstaged} unstaged`);
    if (result.counts.untracked) parts.push(`${result.counts.untracked} untracked`);
    result.safeReason = `uncommitted changes present (${parts.join(', ')}) — review before destructive actions`;
  } else {
    result.safeToProceed = null;
    result.safeReason = 'git status unavailable';
  }

  return result;
}

module.exports = { getRepoHealth, READONLY_SUBCOMMANDS };
