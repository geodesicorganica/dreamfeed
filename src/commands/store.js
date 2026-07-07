'use strict';
// Control-plane sidecar store (D31): intents, plans, approvals, executions.
// App-owned, gitignored, versioned; NEVER authority over source truth — losing
// this directory loses lifecycle history, not work data. Single-process
// write-through JSON (the server is the only writer).

const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 2;
const APP_ROOT = path.resolve(__dirname, '..', '..');

// Test isolation: suites point DREAMFEED_STATE_DIR at a temp dir so runs never
// touch the developer's real sidecar. Resolved per call, not at require time.
function stateDir() {
  return process.env.DREAMFEED_STATE_DIR || path.join(APP_ROOT, '.dreamfeed');
}
function recordsFile() { return path.join(stateDir(), 'records.json'); }

function emptyRecords() {
  return { schemaVersion: SCHEMA_VERSION, counter: 0, intents: {}, plans: {}, approvals: {}, executions: {}, memories: {} };
}

function migrate(rec) {
  if (!rec || typeof rec !== 'object') throw new Error('unsupported records schemaVersion: missing');
  if (rec.schemaVersion === SCHEMA_VERSION) {
    return { ...emptyRecords(), ...rec, memories: rec.memories || {} };
  }
  if (rec.schemaVersion === 1) {
    return {
      schemaVersion: SCHEMA_VERSION,
      counter: Number.isInteger(rec.counter) ? rec.counter : 0,
      intents: rec.intents || {},
      plans: rec.plans || {},
      approvals: rec.approvals || {},
      executions: rec.executions || {},
      memories: {},
    };
  }
  throw new Error(`unsupported records schemaVersion: ${rec.schemaVersion == null ? 'missing' : rec.schemaVersion}`);
}

function load() {
  let rec;
  try {
    rec = JSON.parse(fs.readFileSync(recordsFile(), 'utf8'));
  } catch { return emptyRecords(); }
  const migrated = migrate(rec);
  if (rec.schemaVersion === 1 && migrated.schemaVersion === SCHEMA_VERSION) save(migrated);
  return migrated;
}

function save(rec) {
  fs.mkdirSync(stateDir(), { recursive: true });
  const tmp = recordsFile() + `.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(rec, null, 1), 'utf8');
  fs.renameSync(tmp, recordsFile());
}

function nextId(rec, prefix) {
  rec.counter += 1;
  return `${prefix}_${rec.counter}`;
}

// put/get/list operate read-modify-write on the single records file.
function put(kind, record) {
  const rec = load();
  rec[kind][record.id] = record;
  save(rec);
  return record;
}
function create(kind, prefix, fields) {
  const rec = load();
  const record = { id: nextId(rec, prefix), createdAt: new Date().toISOString(), ...fields };
  rec[kind][record.id] = record;
  save(rec);
  return record;
}
function get(kind, id) {
  const rec = load();
  return rec[kind][id] || null;
}
function list(kind) {
  const rec = load();
  return Object.values(rec[kind]);
}
function snapshot() {
  const rec = load();
  return { intents: Object.values(rec.intents), plans: Object.values(rec.plans), approvals: Object.values(rec.approvals), executions: Object.values(rec.executions), memories: Object.values(rec.memories) };
}

module.exports = { stateDir, create, put, get, list, snapshot, SCHEMA_VERSION };
