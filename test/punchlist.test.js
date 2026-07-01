'use strict';
// Portable punchlist tests — no live Stakeport files required.
// Stakeport-live tests moved to test/integration/punchlist-stakeport.test.js.
const test = require('node:test');
const assert = require('node:assert');
const { readRepoFile } = require('../src/server');
const { getRepoHealth } = require('../src/repohealth');
const { buildState } = require('../src/state');

test('B6 /api/file: rejects path traversal', () => {
  for (const p of ['../../../etc/passwd', '..\\..\\secret', 'agents/../../outside.md']) {
    const r = readRepoFile(p);
    assert.ok(r.error, `traversal not rejected for ${p}`);
  }
});

test('B6 /api/file: rejects .git, node_modules, and non-text extensions', () => {
  assert.ok(readRepoFile('.git/config').error, '.git not rejected');
  assert.ok(readRepoFile('tools/command-center/node_modules/x.js').error, 'node_modules not rejected');
  assert.ok(readRepoFile('docs/Stakeport__CEE_02_Master_Consolidation_V1.docx').error, 'non-text ext not rejected');
});

test('B6 /api/file: missing path and missing file handled', () => {
  assert.ok(readRepoFile(null).error);
  assert.ok(readRepoFile('agents/founder/outputs/does-not-exist.md').error);
});

test('5b-r2 Overview: state exposes everything the home dashboard composes', () => {
  const st = buildState();
  for (const k of ['approvals', 'workItems', 'strategicInitiatives', 'sources', 'roadmap', 'milestones']) {
    assert.ok(Array.isArray(st[k]), `state.${k} is an array for the Overview`);
  }
  const h = getRepoHealth();
  assert.ok(h.audit && 'everRun' in h.audit, 'overview reads audit.everRun');
  assert.ok(Array.isArray(h.validationCommands), 'overview reads validationCommands');
});
