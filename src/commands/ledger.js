'use strict';
// Immutable audit ledger (D31): append-only JSONL, hash-chained. Every
// lifecycle transition appends exactly one event carrying actor, timestamp,
// record ids, prior/result state, and the hash of the previous event. There is
// no API to modify or delete an event; verifyChain() proves integrity.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { stateDir } = require('./store');

function ledgerFile() { return path.join(stateDir(), 'ledger.jsonl'); }

function hashEvent(evt) {
  return crypto.createHash('sha256').update(JSON.stringify(evt), 'utf8').digest('hex');
}

function readAll() {
  let raw;
  try { raw = fs.readFileSync(ledgerFile(), 'utf8'); } catch { return []; }
  return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function appendEvent({ type, actor, ...fields }) {
  const events = readAll();
  const last = events[events.length - 1] || null;
  const body = {
    seq: (last ? last.seq : 0) + 1,
    ts: new Date().toISOString(),
    prev: last ? last.hash : null,
    type,
    actor: actor || 'operator',
    ...fields,
  };
  const evt = { ...body, hash: hashEvent(body) };
  fs.mkdirSync(stateDir(), { recursive: true });
  fs.appendFileSync(ledgerFile(), JSON.stringify(evt) + '\n', 'utf8');
  return evt;
}

function readLedger({ after = 0, limit = 200 } = {}) {
  return readAll().filter((e) => e.seq > after).slice(0, limit);
}

// Recompute every hash and prev-link. Returns { ok } or the first bad seq.
function verifyChain() {
  const events = readAll();
  let prev = null;
  for (const evt of events) {
    const { hash, ...body } = evt;
    if (body.prev !== (prev ? prev.hash : null)) return { ok: false, badSeq: evt.seq, reason: 'broken prev link' };
    if (hashEvent(body) !== hash) return { ok: false, badSeq: evt.seq, reason: 'hash mismatch' };
    prev = evt;
  }
  return { ok: true, length: events.length };
}

module.exports = { appendEvent, readLedger, verifyChain };
