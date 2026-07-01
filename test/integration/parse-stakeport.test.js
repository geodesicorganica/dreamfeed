'use strict';
// Stakeport-specific parse tests requiring live governance files.
// Requires DREAMFEED_STAKEPORT_ROOT to be set.
const STAKEPORT_ROOT = process.env.DREAMFEED_STAKEPORT_ROOT;
if (!STAKEPORT_ROOT) { process.exit(0); }

const test = require('node:test');
const assert = require('node:assert');
const { loadStalenessThresholds } = require('../../src/parse');

test('staleness thresholds load from cockpit-integration-guide.md §3 (single source of truth)', () => {
  const t = loadStalenessThresholds(STAKEPORT_ROOT);
  assert.strictEqual(t.strategic_initiatives, 14);
  assert.strictEqual(t.weekly_priorities, 7);
  assert.strictEqual(t.decision_queue, 7);
  assert.strictEqual(t.agent_dispatch, 14);
  assert.strictEqual(t.blocked_items, 7);
});
