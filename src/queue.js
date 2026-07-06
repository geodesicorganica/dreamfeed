'use strict';
// Daily execution queue + sprint metrics (D31 §4). Pure projection over the
// native state — computed per request, never stored, never flattening Goals
// and Operations into each other: every item keeps its intact parent chain.

const { buildNativeState } = require('./nativeSchema');
const { field } = require('./parse');

const DAY_MS = 24 * 60 * 60 * 1000;

// LOCAL calendar day (not UTC): task Scheduled values are local calendar dates,
// so today/rollover/upcoming must be judged in the operator's local zone.
// toISOString() would shift the boundary by the UTC offset and misclassify
// tasks around local midnight.
function isoDay(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function collectItems(native) {
  const items = [];
  for (const goal of native.goals) {
    for (const phase of goal.phases) {
      for (const ms of phase.milestones) {
        for (const task of ms.tasks) items.push({ task, streamType: 'goal', containerId: goal.id.value });
      }
    }
  }
  for (const op of native.operations) {
    for (const wf of op.workflows) {
      for (const task of wf.tasks) items.push({ task, streamType: 'operation', containerId: op.id.value });
    }
  }
  return items;
}

// Queue sections: today (scheduled today, or active), rolledOver (scheduled in
// the past and not done), upcoming (next 7 days). Sort: blocked last, then by
// scheduled date, then by id — stable and explainable.
function buildQueue({ repoRoot, today = new Date() } = {}) {
  const native = buildNativeState({ repoRoot, today });
  const day = isoDay(today);
  const horizon = isoDay(new Date(today.getTime() + 7 * DAY_MS));
  const sections = { today: [], rolledOver: [], upcoming: [] };
  if (!native.hasNative) {
    return { hasNative: false, sections, blockers: [], counts: { today: 0, rolledOver: 0, upcoming: 0 }, parseErrors: native.parseErrors };
  }
  for (const item of collectItems(native)) {
    const status = item.task.status.value;
    const scheduled = item.task.scheduled.value;
    if (status === 'done') continue;
    const entry = { ...item, queueState: field(status === 'blocked' ? 'blocked' : 'planned', 'Derived') };
    if (scheduled && scheduled < day) {
      sections.rolledOver.push({ ...entry, rolledOver: field(true, 'Derived') });
    } else if (scheduled === day || status === 'active') {
      sections.today.push(entry);
    } else if (scheduled && scheduled <= horizon) {
      sections.upcoming.push(entry);
    }
  }
  const rank = (e) => (e.task.status.value === 'blocked' ? 1 : 0);
  const key = (e) => `${e.task.scheduled.value || '9999-99-99'}|${e.task.id.value}`;
  for (const s of Object.values(sections)) s.sort((a, b) => rank(a) - rank(b) || (key(a) < key(b) ? -1 : 1));
  return {
    hasNative: true,
    sections,
    blockers: native.blockers,
    counts: { today: sections.today.length, rolledOver: sections.rolledOver.length, upcoming: sections.upcoming.length },
    parseErrors: native.parseErrors,
  };
}

// Sprint metrics (D31 placeholder semantics — sprint = sprint_week anchor +
// scheduled dates; rollover = past-scheduled incomplete). Derived at read time.
function buildSprintMetrics({ repoRoot, today = new Date() } = {}) {
  const native = buildNativeState({ repoRoot, today });
  const day = isoDay(today);
  const counts = { planned: 0, active: 0, done: 0, blocked: 0, rolledOver: 0 };
  let estTotal = 0, estRemaining = 0;
  if (!native.hasNative) return { hasNative: false, counts, estTotal: 0, estRemaining: 0, completionPct: null };
  for (const item of collectItems(native)) {
    const status = item.task.status.value;
    if (status && counts[status] !== undefined) counts[status]++;
    const scheduled = item.task.scheduled.value;
    if (scheduled && scheduled < day && status !== 'done') counts.rolledOver++;
    const est = item.task.est_hours.value;
    if (typeof est === 'number') {
      estTotal += est;
      if (status !== 'done') estRemaining += est;
    }
  }
  const total = counts.planned + counts.active + counts.done + counts.blocked;
  return {
    hasNative: true,
    counts,
    estTotal,
    estRemaining,
    completionPct: total > 0 ? Math.round((counts.done / total) * 100) : null,
  };
}

module.exports = { buildQueue, buildSprintMetrics };
