'use strict';
// repo-harness-auditor (in-repo realization) — Goal C punchlist item B2.
//
// Decision (2026-06-13): the `repo-harness-auditor` skill does not exist in this
// repo. Rather than reference an unknown external skill or add an agent skill
// (which would trigger the goal-setting-skill-structure constraint), the audit
// workflow is realized as this read-only project harness. It runs the repo's
// existing READ-ONLY checks and writes a timestamped status record the Dreamfeed
// Repo Health panel reads. The cockpit NEVER runs this (no agent execution from
// the cockpit) — a human/agent runs `node audit.js` from the repo root; the
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

// Standalone: APP_ROOT is this tool's own directory.
// Project root is read from project-config.json (nullable).
const APP_ROOT = path.resolve(__dirname);
const PROJECT_CONFIG_FILE = path.join(APP_ROOT, 'project-config.json');
const STATUS_FILE = path.join(APP_ROOT, 'audit-status.json');

let REPO_ROOT = null;
try {
  const cfg = JSON.parse(fs.readFileSync(PROJECT_CONFIG_FILE, 'utf8'));
  if (cfg && cfg.root) REPO_ROOT = cfg.root;
} catch { /* no project configured */ }

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
  return { label, command: `${command} ${args.join(' ')}`.trim(), cwd: path.relative(APP_ROOT, cwd) || '.', status, exitCode, durationMs, tail };
}

function gitStatusSummary(root) {
  try {
    const out = execFileSync('git', ['--no-optional-locks', 'status', '--porcelain=v1'], { cwd: root, encoding: 'utf8', timeout: 5000, windowsHide: true });
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
  // State 1: no project configured.
  if (!REPO_ROOT) {
    fs.writeFileSync(STATUS_FILE, JSON.stringify({
      auditor: 'repo-harness-auditor (in-repo harness: audit.js)',
      overall: 'unavailable', generatedAt: new Date().toISOString(),
      repoRoot: null, commands: [], git: null,
      unavailableReason: 'No project configured.',
    }, null, 2) + '\n', 'utf8');
    console.log('[repo-harness-auditor] No project configured — audit unavailable.');
    process.exit(0);
  }

  // State 2 / 3: project configured — determine if the Stakeport harness is present.
  const hasStakeportHarness = fs.existsSync(
    path.join(REPO_ROOT, 'tools', 'governance-migration', 'validate.js'));

  const results = [
    run('cockpit tests', 'node', ['--test', 'test/*.test.js'], APP_ROOT),
  ];
  if (hasStakeportHarness) {
    results.push(
      run('governance frontmatter validation', 'node', ['tools/governance-migration/validate.js'], REPO_ROOT),
      run('governance schema fixtures', 'node', ['tools/governance-migration/test-fixtures.js'], REPO_ROOT),
    );
  }

  const overall = hasStakeportHarness
    ? (results.every(r => r.status === 'pass') ? 'pass' : 'fail')
    : 'unavailable';

  const record = {
    auditor: 'repo-harness-auditor (in-repo harness: audit.js)',
    generatedAt: new Date().toISOString(),
    repoRoot: require('./src/parse').canonicalKey(REPO_ROOT),
    overall,
    git: gitStatusSummary(REPO_ROOT),
    commands: results,
    ...(overall === 'unavailable' && { unavailableReason: 'No audit harness for this project.' }),
  };
  fs.writeFileSync(STATUS_FILE, JSON.stringify(record, null, 2) + '\n', 'utf8');
  console.log(`[repo-harness-auditor] overall: ${record.overall.toUpperCase()}  (${new Date(record.generatedAt).toLocaleString()})`);
  for (const c of results) console.log(`  ${c.status === 'pass' ? 'PASS' : 'FAIL'}  ${c.label} (exit ${c.exitCode}, ${c.durationMs}ms)`);
  console.log(`  status written: ${STATUS_FILE}`);
  process.exit(overall === 'fail' ? 1 : 0);
}

if (require.main === module) main();
module.exports = { STATUS_FILE };
