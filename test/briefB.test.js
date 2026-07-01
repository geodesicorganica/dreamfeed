'use strict';
// Portable Brief B + Repo Health static guards.
// All Stakeport-live tests moved to test/integration/briefB-stakeport.test.js.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { READONLY_SUBCOMMANDS } = require('../src/repohealth');

test('READONLY_SUBCOMMANDS allowlist is correct and excludes destructive verbs', () => {
  for (const c of READONLY_SUBCOMMANDS) {
    assert.ok(['rev-parse', 'status', 'log', 'rev-list'].includes(c), `unexpected allowlisted subcommand ${c}`);
  }
  assert.ok(!READONLY_SUBCOMMANDS.has('commit') && !READONLY_SUBCOMMANDS.has('push') &&
    !READONLY_SUBCOMMANDS.has('reset') && !READONLY_SUBCOMMANDS.has('checkout') && !READONLY_SUBCOMMANDS.has('clean'),
    'destructive subcommands must never be allowlisted');
});

test('Repo Health source uses no destructive git verbs (static guard)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'repohealth.js'), 'utf8');
  for (const verb of ['commit', 'push', 'reset', 'checkout', 'clean', 'rebase', 'merge', "'add'", 'restore']) {
    assert.ok(!new RegExp(`['\\[]\\s*['"]${verb}`).test(src), `repohealth.js must not reference git ${verb}`);
  }
});
