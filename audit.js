'use strict';
// repo-harness-auditor (in-repo realization) — Goal C punchlist item B2.
//
// Decision (2026-06-13): the `repo-harness-auditor` skill does not exist in this
// repo. Rather than reference an unknown external skill or add an agent skill
// (which would trigger the goal-setting-skill-structure constraint), the audit
// workflow is realized as this read-only project harness. It runs the repo's
// existing READ-ONLY checks and writes a timestamped status record the Dreamfeed
// Repo Health panel reads. The cockpit NEVER runs this (no agent execution from
// the cockpit) — a human/agent runs `node tools/command-center/audit.js`; the
// cockpit only reads `audit-status.json`.
//
// Read-only: this harness runs governance validators, the cockpit test suite,
// and `git status` (non-destructive). It writes only its own audit-status file
// (NOT a governance/content source file), so the cockpit's zero-write-back
// guarantee is unaffected (the cockpit reads; this harness — run separately —
// writes only its status sidecar).

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const STATUS_FILE = path.join(__dirname, 'audit-status.json');

function run(label, command, args, cwd) {
  const startedWall = process.hrtime.bigint();
  let exitCode = 0, status = 'pass', output = '';
  try {
    output = execFileSync(command, args, { cwd, encoding: 'utf8', timeout: 120000, windowsHide: true });
  } catch (err) {
    exitCode = typeof err.status === 'number' ? err.status : 1;
    status = 'fail';
    output = String((err.stdout || '') + (err.stderr || '') || err.message || err);
  }
  const durationMs = Number((process.hrtime.bigint() - startedWall) / 1000000n);
  // Capture a short tail of output for the panel (no secrets in this repo's tooling output).
  const tail = output.split(/\r?\n/).filter(Boolean).slice(-3).join(' | ').slice(0, 300);
  return { label, command: `${command} ${args.join(' ')}`.trim(), cwd: path.relative(REPO_ROOT, cwd) || '.', status, exitCode, durationMs, tail };
}

function gitStatusSummary() {
  try {
    const out = execFileSync('git', ['--no-optional-locks', 'status', '--porcelain=v1'], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 5000, windowsHide: true });
    const lines = out.split('\n').filter(Boolean);
    let staged = 0, unstaged = 0, untracked = 0;
    for (const l of lines) {
      if (l.startsWith('??')) { untracked++; continue; }
      if (l[0] && l[0] !== ' ' && l[0] !== '?') staged++;
      if (l[1] && l[1] !== ' ' && l[1] !== '?') unstaged++;
    }
    return { clean: lines.length === 0, staged, unstaged, untracked };
  } catch (err) { return { error: String(err.message || err).split('\n')[0] }; }
}

function main() {
  const commands = [
    run('governance frontmatter validation', 'node', ['tools/governance-migration/validate.js'], REPO_ROOT),
    run('governance schema fixtures', 'node', ['tools/governance-migration/test-fixtures.js'], REPO_ROOT),
    run('cockpit tests', 'node', ['--test', 'test/parse.test.js', 'test/objects.test.js', 'test/state.test.js', 'test/briefB.test.js'], __dirname),
  ];
  const record = {
    auditor: 'repo-harness-auditor (in-repo harness: tools/command-center/audit.js)',
    generatedAt: new Date().toISOString(),
    // Canonical identity of the audited root (matches src/parse.js canonicalKey),
    // so Repo Health never displays this record against a different project.
    repoRoot: require('./src/parse').canonicalKey(REPO_ROOT),
    overall: commands.every(c => c.status === 'pass') ? 'pass' : 'fail',
    git: gitStatusSummary(),
    commands,
  };
  fs.writeFileSync(STATUS_FILE, JSON.stringify(record, null, 2) + '\n', 'utf8');
  // Human-facing summary.
  console.log(`[repo-harness-auditor] overall: ${record.overall.toUpperCase()}  (${new Date(record.generatedAt).toLocaleString()})`);
  for (const c of commands) console.log(`  ${c.status === 'pass' ? 'PASS' : 'FAIL'}  ${c.label} (exit ${c.exitCode}, ${c.durationMs}ms)`);
  console.log(`  status written: ${path.relative(REPO_ROOT, STATUS_FILE)}`);
  process.exit(record.overall === 'pass' ? 0 : 1);
}

if (require.main === module) main();
module.exports = { STATUS_FILE };
