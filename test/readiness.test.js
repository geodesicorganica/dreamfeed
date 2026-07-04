'use strict';
// Git/workspace write-readiness verdicts (D31 step 5). Per-op semantics:
// commit REQUIRES staged work, add requires unstaged work, push requires an
// upstream and ahead commits — a blanket clean-tree gate would be wrong.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { getRepoHealth } = require('../src/repohealth');

function tmp(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }
function git(cwd, args) { return execFileSync('git', args, { cwd, encoding: 'utf8' }); }

test('readiness: non-git folder disables every git action with the reason', () => {
  const dir = tmp('df-nogit-');
  const wr = getRepoHealth(dir).writeReadiness;
  for (const op of ['gitAdd', 'gitCommit', 'gitBranch', 'gitSwitch', 'gitPush']) {
    assert.strictEqual(wr[op].ok, false, `${op} must be unavailable`);
    assert.match(wr[op].reason, /not a git repository/);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('readiness: verdicts track the actual workspace state per operation', () => {
  const dir = tmp('df-git-');
  git(dir, ['init', '-b', 'main']);
  git(dir, ['config', 'user.email', 't@d.local']);
  git(dir, ['config', 'user.name', 'T']);
  fs.writeFileSync(path.join(dir, 'a.md'), 'base\n', 'utf8');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', 'base']);

  // Clean tree, no upstream.
  let wr = getRepoHealth(dir).writeReadiness;
  assert.strictEqual(wr.gitAdd.ok, false, 'nothing to stage on a clean tree');
  assert.strictEqual(wr.gitCommit.ok, false, 'nothing staged on a clean tree');
  assert.strictEqual(wr.gitBranch.ok, true);
  assert.strictEqual(wr.gitSwitch.ok, true);
  assert.strictEqual(wr.gitSwitch.warning, undefined, 'clean switch carries no warning');
  assert.strictEqual(wr.gitPush.ok, false);
  assert.match(wr.gitPush.reason, /no upstream/);

  // Untracked file → add ready, commit not yet, switch warns.
  fs.writeFileSync(path.join(dir, 'b.md'), 'new\n', 'utf8');
  wr = getRepoHealth(dir).writeReadiness;
  assert.strictEqual(wr.gitAdd.ok, true);
  assert.strictEqual(wr.gitCommit.ok, false);
  assert.ok(wr.gitSwitch.warning, 'dirty switch carries an explicit warning');

  // Staged → commit ready.
  git(dir, ['add', '-A']);
  wr = getRepoHealth(dir).writeReadiness;
  assert.strictEqual(wr.gitCommit.ok, true);
  assert.match(wr.gitCommit.reason, /1 file/);
  fs.rmSync(dir, { recursive: true, force: true });
});
