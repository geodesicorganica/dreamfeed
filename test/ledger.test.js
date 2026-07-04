'use strict';
// Audit ledger integrity (D31): append-only, hash-chained, tamper-evident.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DREAMFEED_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'df-ledger-'));

const { appendEvent, readLedger, verifyChain } = require('../src/commands/ledger');

const LEDGER_FILE = path.join(process.env.DREAMFEED_STATE_DIR, 'ledger.jsonl');

test('ledger: events chain by hash with monotonic sequence', () => {
  const e1 = appendEvent({ type: 'intent-created', intentId: 'int_1', kind: 'test' });
  const e2 = appendEvent({ type: 'plan-computed', planId: 'pln_1' });
  const e3 = appendEvent({ type: 'approval', planId: 'pln_1', priorState: 'planned', resultState: 'approved' });
  assert.deepStrictEqual([e1.seq, e2.seq, e3.seq], [1, 2, 3]);
  assert.strictEqual(e1.prev, null);
  assert.strictEqual(e2.prev, e1.hash);
  assert.strictEqual(e3.prev, e2.hash);
  assert.deepStrictEqual(verifyChain(), { ok: true, length: 3 });
});

test('ledger: readLedger pages by sequence', () => {
  const events = readLedger({ after: 1 });
  assert.deepStrictEqual(events.map((e) => e.seq), [2, 3]);
});

test('ledger: tampering with a past event breaks chain verification', () => {
  const lines = fs.readFileSync(LEDGER_FILE, 'utf8').split('\n').filter(Boolean);
  const evt = JSON.parse(lines[1]);
  evt.planId = 'pln_FORGED';
  lines[1] = JSON.stringify(evt);
  fs.writeFileSync(LEDGER_FILE, lines.join('\n') + '\n', 'utf8');
  const v = verifyChain();
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.badSeq, 2);
});

test('ledger: appends after tampering still detected (no silent re-chain)', () => {
  appendEvent({ type: 'execution-started', executionId: 'exe_1' });
  assert.strictEqual(verifyChain().ok, false, 'forged history remains detectable');
});
