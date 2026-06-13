'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  adaptStrategicInitiatives, adaptWeeklyPriorities, adaptDecisionQueue, adaptAgentDispatch,
} = require('../src/objects');

const THRESHOLDS = { strategic_initiatives: 14, weekly_priorities: 7, decision_queue: 7, agent_dispatch: 14 };
const TODAY = new Date('2026-06-12T12:00:00Z');
const fm = (type) => ({ governance_type: type, date_modified: '2026-06-12' });
const mkFile = (type, body) => ({ path: `synthetic/${type}.md`, content: body, frontmatter: fm(type), error: null });

test('§2 Strategic Initiative: status splits on " — ", enum-matched; no match degrades', () => {
  const body = [
    '| Initiative | Stage | Status | Owner | Success Definition |',
    '|---|---|---|---|---|',
    '| Alpha | crawl | active — doing things [manual: 2026-06-12] | Founder | Done when X |',
    '| Beta | walk | weird-state — note | Founder | Done when Y |',
    '| Gamma | run | complete | CoS | Done when Z |',
  ].join('\n');
  const { objects, errors } = adaptStrategicInitiatives(mkFile('strategic_initiatives', body), THRESHOLDS, TODAY);
  assert.strictEqual(errors.length, 0);
  assert.strictEqual(objects.length, 3);
  const [a, b, g] = objects;
  assert.strictEqual(a.status.value, 'active');
  assert.strictEqual(a.status.tier, 'Derived');
  assert.strictEqual(a.status_note.value.includes('doing things'), true);
  assert.strictEqual(a.manual_flag.value, true);
  assert.strictEqual(a.name.tier, 'Canonical');
  assert.strictEqual(b.status.nys, true);            // unmatched token → not yet structured
  assert.strictEqual(g.status.value, 'complete');    // no separator: whole cell is the token
  assert.strictEqual(g.status_note, undefined);      // empty remainder → omitted
  // every field carries exactly one tier
  for (const o of objects) {
    for (const [k, v] of Object.entries(o)) {
      if (k === 'objectType') continue;
      assert.ok(['Canonical', 'Derived', 'Candidate'].includes(v.tier), `${k} untiered`);
    }
  }
});

test('§3 Work Item: leading status token, initiative_link resolution incl. dash normalization', () => {
  const initiatives = adaptStrategicInitiatives(mkFile('strategic_initiatives', [
    '| Initiative | Stage | Status | Owner | Success Definition |',
    '|---|---|---|---|---|',
    '| Build Thing (Phase 1 — read-only) | crawl | active — x | Founder | done |',
  ].join('\n')), THRESHOLDS, TODAY).objects;

  const body = [
    '| Rank | Action | Owner | Initiative | Est | Status |',
    '|------|--------|-------|-----------|-----|--------|',
    '| P1 | Do the thing | Dev | Build Thing (Phase 1 - read-only) | 2h | blocked - waiting on gate [manual: 2026-06-12] |',
    '| P2 | Other thing | Founder | Unknown Initiative | 1h | mystery status |',
  ].join('\n');
  const wpFile = { path: 'synthetic/weekly_priorities.md', content: body,
    frontmatter: { ...fm('weekly_priorities'), sprint_week: '2026-06-08' }, error: null };
  const { objects } = adaptWeeklyPriorities(wpFile, initiatives, THRESHOLDS, TODAY);
  assert.strictEqual(objects.length, 2);
  const [p1, p2] = objects;
  assert.strictEqual(p1.status.value, 'blocked');
  assert.strictEqual(p1.status_note.value.startsWith('waiting on gate'), true);
  assert.strictEqual(p1.manual_flag.value, true);
  assert.strictEqual(p1.initiative_link.value, 'build-thing-phase-1-read-only'); // hyphen matched em-dash SI
  assert.strictEqual(p1.sprint_week.value, '2026-06-08');
  assert.strictEqual(p2.status.nys, true);            // unmatched → not yet structured
  assert.strictEqual(p2.initiative_link.nys, true);   // unresolved → not yet structured
});

test('§4A Approval (decision): RESOLVED marker → resolved + resolution_date; open otherwise', () => {
  const body = [
    '| # | Decision | Consequence if deferred | Decision maker | Information needed |',
    '|---|---|---|---|---|',
    '| D1 | Decide a thing? | Slip. | Founder | Review the packet. |',
    '| D2 | **[RESOLVED 2026-06-07]** Old decision. | n/a | Founder | n/a |',
  ].join('\n');
  const { objects } = adaptDecisionQueue(mkFile('decision_queue', body), THRESHOLDS, TODAY);
  assert.strictEqual(objects.length, 2);
  assert.strictEqual(objects[0].state.value, 'open');
  assert.strictEqual(objects[0].decision.tier, 'Canonical');
  assert.strictEqual(objects[1].state.value, 'resolved');
  assert.strictEqual(objects[1].resolution_date.value, '2026-06-07');
});

test('§4B Approval (dispatch-gate): heading-derived state, anchor-failure degradation', () => {
  const body = [
    '### Active Dispatches',
    '',
    '**Developer Agent** | Initiative: Build Thing',
    '**Status:** TRANSMITTED - ACTIVE.',
    '**Task:** Build it.',
    '',
    '### Active Dispatches (conditional - fire when the unblocking condition is met)',
    '',
    '**Chief of Staff Agent** | Initiative: Launch Website',
    '**Trigger:** Founder approves the drafts.',
    '**Task:** Run the skill.',
    '',
    '### Pending Dispatches (initiatives without OS support - not yet issuable)',
    '',
    '| Initiative | Blocking reason | What\'s needed |',
    '|---|---|---|',
    '| ABM Motion | No agent exists | Founder scope note |',
  ].join('\n');
  const { objects } = adaptAgentDispatch(mkFile('agent_dispatch', body), THRESHOLDS, TODAY);
  assert.strictEqual(objects.length, 3);
  const [transmitted, conditional, pending] = objects;

  assert.strictEqual(transmitted.state.value, 'transmitted');
  assert.strictEqual(transmitted.title.nys, true);          // no **Trigger:** anchor → degrade, never fuzzy
  assert.strictEqual(transmitted.target_agent.value, 'Developer Agent');
  assert.strictEqual(transmitted.target_agent.tier, 'Canonical');

  assert.strictEqual(conditional.state.value, 'conditional');
  assert.strictEqual(conditional.title.value, 'Founder approves the drafts.');
  assert.strictEqual(conditional.id.value, 'dispatch-launch-website');

  assert.strictEqual(pending.state.value, 'pending');
  assert.strictEqual(pending.title.value, 'Founder scope note');       // What's-needed cell
  assert.strictEqual(pending.gate_condition.value, 'No agent exists'); // Blocking-reason cell
  assert.strictEqual(pending.target_agent.nys, true);                  // no bolded agent anchor in table
  assert.strictEqual(pending.initiative.value, 'ABM Motion');
});
