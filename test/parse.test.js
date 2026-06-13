'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  extractFrontmatter, parseFrontmatterLines, detectSchemaFamily, splitRow,
  extractTables, loadStalenessThresholds, computeFreshness, slugify,
} = require('../src/parse');

// Synthetic unit fixtures only — these are test inputs, not app seed data;
// the app itself loads exclusively from the live governance files.

test('frontmatter: extracts and parses scalars, quoted dates, booleans, arrays', () => {
  const doc = [
    '---',
    'governance_type: weekly_priorities',
    'status: active',
    'date_modified: "2026-06-12"',
    'manual_entries_present: true',
    'derived_from:',
    '  - "a.md"',
    '  - "b.md"',
    '---',
    '# body',
  ].join('\n');
  const block = extractFrontmatter(doc);
  assert.ok(block);
  const fm = parseFrontmatterLines(block.lines);
  assert.strictEqual(fm.governance_type, 'weekly_priorities');
  assert.strictEqual(fm.date_modified, '2026-06-12');
  assert.strictEqual(fm.manual_entries_present, true);
  assert.deepStrictEqual(fm.derived_from, ['a.md', 'b.md']);
});

test('frontmatter: absent or unterminated block returns null', () => {
  assert.strictEqual(extractFrontmatter('# no frontmatter'), null);
  assert.strictEqual(extractFrontmatter('---\nkey: value\nno terminator'), null);
});

test('schema-family detection: governance / content / untyped (contract §8)', () => {
  assert.strictEqual(detectSchemaFamily({ governance_type: 'decision_queue' }), 'governance');
  assert.strictEqual(detectSchemaFamily({ content_type: 'risk_brief' }), 'content');
  assert.strictEqual(detectSchemaFamily({ 'spec-id': 'PS-002' }), 'untyped');
  assert.strictEqual(detectSchemaFamily(null), 'untyped');
});

test('table rows: escaped pipes inside cells survive splitting', () => {
  const cells = splitRow('| name | crawl \\| walk \\| run | owner |');
  assert.deepStrictEqual(cells, ['name', 'crawl | walk | run', 'owner']);
});

test('table extraction: finds header + rows with 1-based line numbers', () => {
  const md = ['intro', '', '| A | B |', '|---|---|', '| 1 | 2 |', '| 3 | 4 |', '', 'outro'].join('\n');
  const tables = extractTables(md);
  assert.strictEqual(tables.length, 1);
  assert.deepStrictEqual(tables[0].headers, ['A', 'B']);
  assert.strictEqual(tables[0].rows.length, 2);
  assert.strictEqual(tables[0].rows[0].line, 5);
});

test('staleness thresholds load from cockpit-integration-guide.md §3 (single source of truth)', () => {
  const t = loadStalenessThresholds();
  assert.strictEqual(t.strategic_initiatives, 14);
  assert.strictEqual(t.weekly_priorities, 7);
  assert.strictEqual(t.decision_queue, 7);
  assert.strictEqual(t.agent_dispatch, 14);
  assert.strictEqual(t.blocked_items, 7);
});

test('freshness: fresh / amber (within 20%) / stale, and degradation (contract §10)', () => {
  const thresholds = { weekly_priorities: 7 };
  const fm = (date) => ({ governance_type: 'weekly_priorities', date_modified: date });
  const today = new Date('2026-06-12T12:00:00Z');
  assert.strictEqual(computeFreshness(fm('2026-06-11'), thresholds, today).value.state, 'fresh');   // 1d
  assert.strictEqual(computeFreshness(fm('2026-06-06'), thresholds, today).value.state, 'amber');   // 6d ≥ 5.6
  assert.strictEqual(computeFreshness(fm('2026-06-04'), thresholds, today).value.state, 'stale');   // 8d > 7
  // last_reviewed_date takes precedence over date_modified
  const reviewed = { governance_type: 'weekly_priorities', date_modified: '2026-05-01', last_reviewed_date: '2026-06-11' };
  assert.strictEqual(computeFreshness(reviewed, thresholds, today).value.state, 'fresh');
  // missing inputs degrade to not-yet-structured, tier retained
  const degraded = computeFreshness({ governance_type: 'unknown_type', date_modified: '2026-06-11' }, thresholds, today);
  assert.strictEqual(degraded.nys, true);
  assert.strictEqual(degraded.tier, 'Derived');
  assert.strictEqual(computeFreshness(null, thresholds, today).nys, true);
});

test('slugify: stable object identity', () => {
  assert.strictEqual(slugify('Build Stakeport OS Command Center (Phase 1 — read-only cockpit)'),
    'build-stakeport-os-command-center-phase-1-read-only-cockpit');
});
