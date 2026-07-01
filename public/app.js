'use strict';
// Dreamfeed cockpit frontend. Server state remains source-backed; shell state
// is deliberately in-memory only. No browser storage or write API is used.

let state = null;
let repoHealth = null;
let project = null;
// In-memory action token (D28 local guard). Read from the /api/project
// descriptor and sent as the X-Dreamfeed-Token header on state-changing calls.
// Held in memory only — never written to any browser-side persistent store.
let actionToken = null;
let browse = null; // in-app folder browser state: { path, parent, atRoot, entries, drives }
let objectRegistry = new Map();
let evidenceRequestId = 0;
const view = {
  tab: 'overview', filterText: '', filterStatus: '', collapsed: {}, graphSel: null,
  selectedObjectId: null, inspectorTab: 'overview', evidence: null,
  // Wide layouts keep all five regions visible. Narrow layouts start with the
  // inspector collapsed and expose it through the command-bar drawer control.
  inspectorOpen: window.innerWidth > 940, bottomOpen: true, sidebarOpen: false, density: 'comfortable', feedback: [],
};

// The explicit Dreamfeed view registry. Existing Command Center tabs are
// projections over these lenses; none are discarded by the shell rebuild.
const LENS_REGISTRY = Object.freeze({
  Dashboard: { tabs: ['overview', 'learning'], defaultTab: 'overview' },
  Board: { tabs: ['board', 'queue', 'milestones'], defaultTab: 'board' },
  Table: { tabs: ['sources', 'health'], defaultTab: 'sources' },
  Document: { tabs: ['roadmap', 'review'], defaultTab: 'review' },
  IDE: { tabs: ['review'], defaultTab: 'review', inspectorMode: 'evidence' },
  Topology: { tabs: ['topology'], defaultTab: 'topology' },
});

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const monoTime = (value) => value ? new Date(value).toLocaleTimeString() : 'n/y/s';

function fv(f) {
  if (!f || f.nys) return '<span class="nys">not yet structured</span>';
  return typeof f.value === 'object' ? esc(JSON.stringify(f.value)) : esc(f.value);
}
function fieldValue(f, fallback = 'not yet structured') { return f && !f.nys && f.value != null ? String(f.value) : fallback; }
function prov(f) { return f && f.tier ? `<span class="prov prov-${f.tier}">${f.tier === 'Candidate' ? 'Candidate' : f.tier}</span>` : ''; }
function row(k, f) { return f === undefined ? '' : `<div class="fieldrow"><span class="k">${esc(k)}</span><span class="v">${fv(f)} ${prov(f)}</span></div>`; }
function pill(label, kind) { return `<span class="pill pill-${kind}">${esc(label)}</span>`; }
function freshChip(f) {
  if (!f || f.nys) return '<span class="freshchip amber">freshness: n/y/s</span>';
  const v = f.value;
  return `<span class="freshchip ${esc(v.state)}">${esc(v.state)} ${esc(v.ageDays)}d/${esc(v.thresholdDays)}d</span>`;
}
function sourceInfo(f) {
  return f && !f.nys && f.value && f.value.file ? { path: f.value.file, locator: f.value.locator || 'source' } : null;
}
function sourceLink(path, label) {
  return path ? `<span class="srclink" data-file="${esc(path)}">${esc(label || path)}</span>` : '<span class="nys">source unavailable</span>';
}
function srcLine(f, extras = []) {
  const source = sourceInfo(f);
  const entries = [];
  if (source) entries.push(`${sourceLink(source.path)} — ${esc(source.locator)}`);
  for (const p of extras.filter(Boolean)) if (!source || p !== source.path) entries.push(sourceLink(p));
  return entries.length ? `<div class="src">source: ${entries.join(' · ')}</div>` : '';
}
function group(key, title, inner, count) {
  const collapsed = !!view.collapsed[key];
  return `<section class="group"><div class="group-head" data-collapse="${esc(key)}"><span class="chev">${collapsed ? '▶' : '▼'}</span><h2>${esc(title)}</h2><span class="count">${esc(count)}</span></div><div class="${collapsed ? 'hidden' : ''}">${inner}</div></section>`;
}
function fileTokens(...texts) {
  const found = new Set();
  const re = /[A-Za-z0-9_./-]+\.(?:md|json|js|html|css|txt)/g;
  for (const text of texts) {
    const matches = text ? String(text).match(re) : null;
    if (matches) matches.forEach((m) => found.add(m.replace(/[`),.]+$/, '')));
  }
  return [...found];
}
function matches(texts, statusValue) {
  if (view.filterText && !texts.join(' ').toLowerCase().includes(view.filterText.toLowerCase())) return false;
  return !(view.filterStatus && (statusValue || 'not yet structured') !== view.filterStatus);
}
function tabLens(tab) {
  return Object.entries(LENS_REGISTRY).find(([, spec]) => spec.tabs.includes(tab))?.[0] || 'Dashboard';
}
function feedback(message) {
  view.feedback.unshift({ at: new Date().toISOString(), message });
  view.feedback = view.feedback.slice(0, 6);
}

// ---------------------------------------------------------------------------
// Derived UI registry — an adapter over server output, never a competing store.
// It provides one stable selection identity regardless of graph/card/table lens.
// ---------------------------------------------------------------------------
function addObject(record) { objectRegistry.set(record.id, record); return record.id; }
function allTiers(object) {
  const tiers = new Set();
  Object.values(object || {}).forEach((v) => { if (v && typeof v === 'object' && v.tier) tiers.add(v.tier); });
  return [...tiers].join(' / ') || 'Derived';
}
function record(id, type, title, source, fields = {}) {
  return addObject({
    id, type, title, state: fields.state || 'not yet structured', owner: fields.owner || 'not yet structured',
    sourceAuthority: fields.sourceAuthority || (source ? source.locator : 'source unavailable'),
    timestamp: fields.timestamp || 'not yet structured', provenance: fields.provenance || 'Derived',
    relationships: fields.relationships || [], nextAction: fields.nextAction || 'Inspect source',
    sourcePath: source ? source.path : fields.sourcePath || null, sourceLocator: source ? source.locator : '',
    overview: fields.overview || [],
  });
}
function recordSourceFile(s) {
  return record(`source:${s.path}`, 'Source file', s.path, { path: s.path, locator: s.rendersObjects ? 'runtime source map' : 'loaded source' }, {
    state: s.fileStatus || 'not yet structured', owner: s.governanceType || s.schemaFamily, timestamp: s.dateModified || 'not yet structured', provenance: 'Canonical', nextAction: 'Open source evidence',
    overview: [['Schema family', s.schemaFamily], ['Freshness', s.freshness?.nys ? 'not yet structured' : `${s.freshness.value.state} · ${s.freshness.value.ageDays}d`], ['Role', s.rendersObjects ? 'renders objects' : 'loaded only']],
  });
}
function ensureFileObject(path) {
  const source = state?.sources?.find((s) => s.path === path);
  if (source) {
    const sourceId = `source:${path}`;
    if (!objectRegistry.has(sourceId)) recordSourceFile(source);
    return sourceId;
  }
  const id = `file:${path}`;
  if (!objectRegistry.has(id)) record(id, 'Source file', path, { path, locator: 'read-only file viewer' }, {
    state: 'source-backed', owner: 'repository', timestamp: 'on demand', provenance: 'Canonical',
    nextAction: 'Read source in inspector', overview: [['Path', path], ['Access', 'GET /api/file allowlist']],
  });
  return id;
}
function buildObjectRegistry() {
  objectRegistry = new Map();
  if (!state) return;
  const initiativeIds = new Map();
  for (const o of state.strategicInitiatives) {
    const id = `initiative:${slug(fieldValue(o.name, 'initiative'))}`;
    initiativeIds.set(fieldValue(o.name), id);
    record(id, 'Strategic initiative', fieldValue(o.name), sourceInfo(o.source_evidence), {
      state: fieldValue(o.status), owner: fieldValue(o.owner), timestamp: fieldValue(o.freshness?.value?.referenceDate ? { value: o.freshness.value.referenceDate } : null),
      provenance: allTiers(o), nextAction: 'Review initiative source',
      overview: [['Stage', fieldValue(o.stage)], ['Status', fieldValue(o.status)], ['Freshness', o.freshness?.nys ? 'not yet structured' : `${o.freshness.value.state} · ${o.freshness.value.ageDays}d`], ['Success definition', fieldValue(o.success_definition)]],
    });
  }
  for (const o of state.workItems) {
    const initiative = fieldValue(o.initiative, 'not yet structured');
    record(`work-item:${fieldValue(o.rank, slug(fieldValue(o.action)))}`, 'Work item', fieldValue(o.action), sourceInfo(o.source_evidence), {
      state: fieldValue(o.status), owner: fieldValue(o.owner), timestamp: fieldValue(o.sprint_week), provenance: allTiers(o),
      relationships: initiativeIds.has(initiative) ? [`Initiative: ${initiative}`] : [`Initiative: ${initiative}`], nextAction: 'Review weekly priority source',
      overview: [['Rank', fieldValue(o.rank)], ['Initiative', initiative], ['Estimate', fieldValue(o.estimate)], ['Week of', fieldValue(o.sprint_week)]],
    });
  }
  for (const o of state.approvals) {
    const title = o.decision ? fieldValue(o.decision) : fieldValue(o.title, 'Dispatch gate');
    record(`approval:${slug(fieldValue(o.id, title))}`, 'Approval', title, sourceInfo(o.source_evidence), {
      state: fieldValue(o.state), owner: fieldValue(o.decision_maker, fieldValue(o.target_agent)), timestamp: fieldValue(o.resolution_date, 'open / current'), provenance: allTiers(o),
      relationships: [fieldValue(o.initiative, '')].filter(Boolean), nextAction: 'Open source for deep review',
      overview: [['ID', fieldValue(o.id)], ['Source kind', fieldValue(o.source_kind)], ['Decision maker', fieldValue(o.decision_maker, fieldValue(o.target_agent))], ['Information needed', fieldValue(o.information_needed)]],
    });
  }
  for (const n of state.topology.nodes) {
    const outs = state.topology.edges.filter((e) => !e.from.nys && e.from.value === n.id.value);
    const ins = state.topology.edges.filter((e) => !e.to.nys && e.to.value === n.id.value);
    record(`topology:${n.id.value}`, 'Topology node', fieldValue(n.name, n.id.value), sourceInfo(n.source_evidence), {
      state: fieldValue(n.status), owner: fieldValue(n.owning_agent || n.layer), timestamp: fieldValue(n.freshness?.value?.referenceDate ? { value: n.freshness.value.referenceDate } : null), provenance: allTiers(n),
      relationships: [...outs.map((e) => `${fieldValue(e.type)} → ${fieldValue(e.to)}`), ...ins.map((e) => `${fieldValue(e.from)} → ${fieldValue(e.type)}`)],
      nextAction: 'Inspect node provenance and relationships', overview: [['Node ID', fieldValue(n.id)], ['Kind', fieldValue(n.nodeType)], ['Status', fieldValue(n.status)], ['Outbound edges', String(outs.length)], ['Inbound edges', String(ins.length)]],
    });
  }
  for (const r of state.roadmap) record(`roadmap:${fieldValue(r.phase_label)}`, 'Roadmap phase', fieldValue(r.phase_label), sourceInfo(r.source_evidence), {
    state: fieldValue(r.target_timing), owner: 'roadmap source', timestamp: 'source-backed timing', provenance: allTiers(r), nextAction: 'Review roadmap source', overview: [['Scope', fieldValue(r.scope_summary)]],
  });
  for (const m of state.milestones) record(`milestone:${fieldValue(m.phase_label)}`, 'Milestone', fieldValue(m.phase_label), sourceInfo(m.source_evidence), {
    state: fieldValue(m.state), owner: 'roadmap source', timestamp: fieldValue(m.target_timing), provenance: allTiers(m), nextAction: 'Review milestone source', overview: [['Scope', fieldValue(m.scope_summary)], ['Connected initiatives', fieldValue(m.connected_initiatives)]],
  });
  for (const r of state.reviews) record(`review:${r.source_path.value}`, 'Review artifact', fieldValue(r.title, r.source_path.value), { path: r.source_path.value, locator: 'review artifact' }, {
    state: fieldValue(r.status), owner: fieldValue(r.producing_agent), timestamp: r.freshness?.nys ? 'not yet structured' : r.freshness.value.referenceDate, provenance: allTiers(r), nextAction: 'Open artifact evidence', overview: [['Schema family', fieldValue(r.schema_family)], ['Lifecycle', fieldValue(r.lifecycle_stage)], ['Review need', fieldValue(r.review_need)]],
  });
  state.sources.forEach(recordSourceFile);
}

function selectObject(id, options = {}) {
  if (!objectRegistry.has(id)) return;
  view.selectedObjectId = id;
  view.inspectorOpen = true;
  view.inspectorTab = options.tab || 'overview';
  if (options.graphKey) view.graphSel = options.graphKey;
  feedback(`Selected ${objectRegistry.get(id).type}: ${objectRegistry.get(id).title}`);
  render();
}
async function openEvidence(path, objectId) {
  const requestId = ++evidenceRequestId;
  const id = objectId || ensureFileObject(path);
  view.selectedObjectId = id;
  view.inspectorOpen = true;
  view.inspectorTab = 'evidence';
  // Without a current root token the stale-root guard cannot protect the read
  // (the path could resolve against a different project). Refuse rather than
  // risk a wrong-project read.
  if (!state || !state.rootToken) {
    view.evidence = { path, loading: false, error: 'Project state not loaded — Refresh before viewing source.' };
    render(); return;
  }
  view.evidence = { path, loading: true, content: null, meta: null, error: null };
  render();
  try {
    // Always carry the active root token so the server rejects a read whose path
    // came from a now-stale project snapshot (vs. resolving it against a new root).
    const response = await fetch('/api/file?path=' + encodeURIComponent(path) + '&token=' + encodeURIComponent(state.rootToken), { cache: 'no-store' });
    const data = await response.json();
    if (requestId !== evidenceRequestId || view.evidence?.path !== path) return;
    view.evidence = data.error ? { path, loading: false, error: data.error } : { path, loading: false, content: data.content, meta: `${data.size} bytes · modified ${data.modified} · GET-only` };
    feedback(`Evidence opened: ${path}`);
  } catch (err) {
    if (requestId !== evidenceRequestId || view.evidence?.path !== path) return;
    view.evidence = { path, loading: false, error: String(err) };
  }
  renderInspector();
  renderBottomPanel();
}

// ---------------------------------------------------------------------------
// Cards, board and overview projections.
// ---------------------------------------------------------------------------
function initiativeHealth(o) {
  const status = o.status.nys ? null : o.status.value;
  const stale = o.freshness && !o.freshness.nys && o.freshness.value.state === 'stale';
  if (status === 'complete') return { bucket: 'Completed', label: 'completed', kind: 'green' };
  if (status === 'active') return stale ? { bucket: 'Behind', label: 'behind (stale)', kind: 'amber' } : { bucket: 'Active', label: 'active / on-track', kind: 'blue' };
  if (status === 'paused' || status === 'proposed') return { bucket: 'Paused / Queued', label: status === 'paused' ? 'paused' : 'queued', kind: 'grey' };
  return { bucket: 'Other', label: 'not yet structured', kind: 'amber' };
}
function initiativeId(o) { return `initiative:${slug(fieldValue(o.name, 'initiative'))}`; }
function initiativeCard(o) {
  const health = initiativeHealth(o); const id = initiativeId(o);
  return `<article class="card click${view.selectedObjectId === id ? ' selected' : ''}" data-object-id="${esc(id)}"><div class="card-head"><div><div class="card-title">${esc(fieldValue(o.name))}</div><div class="card-sub">${esc(fieldValue(o.owner))} · stage ${esc(fieldValue(o.stage))}</div></div><div>${pill(health.label, health.kind)}<div>${freshChip(o.freshness)}</div></div></div>${row('status', o.status)}${row('detail', o.status_note)}<div class="fieldrow"><span class="k">target date</span><span class="v"><span class="nys">not yet structured</span> <span class="prov prov-Derived">no source field</span></span></div>${row('success definition', o.success_definition)}${srcLine(o.source_evidence)}</article>`;
}
function renderInitiatives() {
  const items = state.strategicInitiatives.filter((o) => matches([fieldValue(o.name), fieldValue(o.owner), fieldValue(o.status_note, '')], o.status.nys ? null : o.status.value));
  const buckets = ['Active', 'Behind', 'Paused / Queued', 'Completed', 'Other'];
  const html = buckets.map((bucket) => {
    const list = items.filter((o) => initiativeHealth(o).bucket === bucket);
    return list.length ? `<div class="detail-sec">${esc(bucket)} — ${list.length}</div><div class="cards">${list.map(initiativeCard).join('')}</div>` : '';
  }).join('');
  return group('si', 'Strategic Initiatives', html || '<p class="odim">No matching initiatives.</p>', `${items.length}/${state.counts.strategicInitiatives}`);
}
function workId(o) { return `work-item:${fieldValue(o.rank, slug(fieldValue(o.action)))}`; }
function renderWorkItems() {
  const items = state.workItems.filter((o) => matches([fieldValue(o.rank), fieldValue(o.action), fieldValue(o.initiative)], o.status.nys ? null : o.status.value));
  const columns = [['active', 'Active', 'blue'], ['blocked', 'Blocked', 'red'], ['queued', 'Queued', 'grey'], ['completed', 'Completed', 'green'], ['nys', 'Not yet structured', 'amber']];
  const week = state.workItems[0] ? fieldValue(state.workItems[0].sprint_week, 'n/y/s') : 'n/y/s';
  const board = columns.map(([key, title, color]) => {
    const list = items.filter((o) => (o.status.nys ? 'nys' : o.status.value) === key);
    if (!list.length) return '';
    return `<div class="kcol"><div class="kcol-head"><span>${pill(title, color)}</span><span class="n">${list.length}</span></div>${list.map((o) => { const id = workId(o); return `<div class="kitem${view.selectedObjectId === id ? ' selected' : ''}" data-object-id="${esc(id)}"><div class="kt">${esc(fieldValue(o.rank))} · ${esc(fieldValue(o.action).slice(0, 110))}</div><div class="km">${esc(fieldValue(o.owner))} · ${esc(fieldValue(o.estimate))} · ${esc(fieldValue(o.initiative).slice(0, 48))}</div>${o.status_note ? `<div class="km">${esc(fieldValue(o.status_note).slice(0, 110))}</div>` : ''}</div>`; }).join('')}</div>`;
  }).join('');
  return group('wi', `Work items — week of ${week}`, `<div class="kanban">${board || '<p class="odim">No matching work items.</p>'}</div>`, `${items.length}/${state.counts.workItems}`);
}
function approvalId(o) { const title = o.decision ? fieldValue(o.decision) : fieldValue(o.title, 'dispatch-gate'); return `approval:${slug(fieldValue(o.id, title))}`; }
function isOpenApproval(o) { return ['open', 'conditional', 'pending'].includes(o.state.nys ? '' : o.state.value); }
function approvalCard(o) {
  const stateValue = fieldValue(o.state); const color = ({ open: 'amber', conditional: 'blue', pending: 'grey', resolved: 'grey', transmitted: 'grey' })[stateValue] || 'grey';
  const id = approvalId(o); const primary = sourceInfo(o.source_evidence); const refs = fileTokens(fieldValue(o.decision, ''), fieldValue(o.information_needed, ''), fieldValue(o.title, ''), fieldValue(o.gate_condition, ''));
  return `<article class="card click${view.selectedObjectId === id ? ' selected' : ''}" data-object-id="${esc(id)}"><div class="card-head"><div class="card-title">${esc(fieldValue(o.id, o.title ? fieldValue(o.title) : 'dispatch gate'))}</div><div>${pill(stateValue, color)}<div>${freshChip(o.freshness)}</div></div></div>${row('decision', o.decision)}${row('gate', o.title)}${row('condition', o.gate_condition)}${row('if deferred', o.consequence_if_deferred)}${row('decision maker', o.decision_maker)}${row('information needed', o.information_needed)}${row('initiative', o.initiative)}${primary ? `<div class="src">deep review: ${sourceLink(primary.path)}${refs.filter((p) => p !== primary.path).map((p) => ` · ${sourceLink(p)}`).join('')}</div>` : '<div class="src">source unavailable</div>'}</article>`;
}
function renderApprovalsBoard() {
  const open = state.approvals.filter(isOpenApproval).filter((o) => matches([fieldValue(o.id, ''), fieldValue(o.decision, ''), fieldValue(o.initiative, '')], o.state.nys ? null : o.state.value));
  return group('ap', 'Approvals — needs founder action', `<div class="cards">${open.map(approvalCard).join('') || '<p class="odim">No open approvals.</p>'}</div>`, `${open.length} open / ${state.counts.approvalsTotal} total`);
}
function renderQueue() {
  const all = state.approvals.filter((o) => matches([fieldValue(o.id, ''), fieldValue(o.decision, ''), fieldValue(o.title, ''), fieldValue(o.initiative, '')], o.state.nys ? null : o.state.value));
  const open = all.filter(isOpenApproval); const history = all.filter((o) => !isOpenApproval(o));
  return `<div class="banner">Approval Queue (FR10) — ${open.length} current items need founder action. Resolved and transmitted history remains below. Select an item to inspect its evidence in the shared inspector.</div>${group('queue-open', 'Open / active approvals', `<div class="cards">${open.map(approvalCard).join('') || '<p class="odim">None open.</p>'}</div>`, open.length)}${group('queue-history', 'Resolved / transmitted history', `<div class="cards">${history.map(approvalCard).join('') || '<p class="odim">No history.</p>'}</div>`, history.length)}`;
}
function tile(big, label, kind, tab) { return `<div class="otile otile-${kind}" data-gotab="${esc(tab)}"><div class="otile-big">${esc(String(big))}</div><div class="otile-label">${esc(label)}</div></div>`; }
function owidget(title, tab, inner, timestamp = '') { return `<section class="owidget"><div class="owidget-head"><h3>${esc(title)}</h3><span class="navlink" data-gotab="${esc(tab)}">open →</span></div>${timestamp ? `<div class="owidget-ts">${esc(timestamp)}</div>` : ''}${inner}</section>`; }
function renderOverview() {
  const approvals = state.approvals.filter(isOpenApproval); const blockers = state.workItems.filter((o) => !o.status.nys && o.status.value === 'blocked');
  const active = state.strategicInitiatives.filter((o) => !o.status.nys && o.status.value === 'active'); const stale = state.sources.filter((s) => s.freshness && !s.freshness.nys && s.freshness.value.state === 'stale');
  const audit = repoHealth?.audit || { everRun: false };
  const strip = `<div class="otiles">${tile(approvals.length, 'open approvals', approvals.length ? 'amber' : 'green', 'queue')}${tile(blockers.length, 'blockers', blockers.length ? 'red' : 'green', 'board')}${tile(active.length, 'active goals', 'blue', 'board')}${tile(repoHealth?.clean === false ? 'dirty' : repoHealth?.clean === true ? 'clean' : '—', 'workspace', repoHealth?.clean === false ? 'amber' : 'green', 'health')}${tile(audit.everRun ? audit.overall || '—' : 'never run', 'last audit', audit.overall === 'pass' ? 'green' : audit.overall === 'fail' ? 'red' : 'grey', 'health')}</div>`;
  const approvalsList = approvals.length ? `<ul class="olist">${approvals.slice(0, 6).map((o) => `<li data-object-id="${esc(approvalId(o))}">${pill(fieldValue(o.state), 'amber')} ${esc(fieldValue(o.id, fieldValue(o.title, 'approval')))} <span class="odim">${esc(fieldValue(o.decision, fieldValue(o.title, '')).slice(0, 88))}</span></li>`).join('')}</ul>` : '<p class="odim">No open approvals.</p>';
  const blockersList = blockers.length ? `<ul class="olist">${blockers.map((o) => `<li data-object-id="${esc(workId(o))}">${pill('blocked', 'red')} ${esc(fieldValue(o.rank))} ${esc(fieldValue(o.action).slice(0, 84))}</li>`).join('')}</ul>` : '<p class="odim">No blockers.</p>';
  const health = repoHealth || {}; const lastCommit = health.lastCommit ? `${health.lastCommit.hash} · ${health.lastCommit.subject}` : 'n/y/s';
  const healthList = `<div class="okv"><span>branch</span><b>${esc(health.branch || '—')}</b></div><div class="okv"><span>workspace</span><b>${health.clean === undefined || health.clean === null ? 'unknown' : health.clean ? 'clean' : 'dirty'}</b></div><div class="okv"><span>last commit</span><b>${esc(lastCommit)}</b></div>`;
  const auditList = `<div class="okv"><span>result</span><b>${esc(audit.everRun ? audit.overall || 'unknown' : 'never run')}</b></div><div class="okv"><span>currency</span><b>${esc(audit.everRun ? audit.freshness || 'unknown' : 'never run')}</b></div><div class="okv"><span>last run</span><b>${esc(audit.lastRunLabel || 'not yet run')}</b></div>`;
  const staleList = stale.length ? `<ul class="olist">${stale.map((s) => `<li data-object-id="source:${esc(s.path)}">${pill('stale', 'red')} ${esc(s.path)}</li>`).join('')}</ul>` : '<p class="odim">No stale source files.</p>';
  const next = [...approvals.map((o) => `Review ${fieldValue(o.id, fieldValue(o.title, 'approval'))}`), ...blockers.map((o) => `Unblock ${fieldValue(o.rank)}: ${fieldValue(o.action).slice(0, 70)}`)];
  const switched = state.isDefaultRoot === false;
  const noObjects = !state.strategicInitiatives.length && !state.workItems.length && !state.approvals.length;
  const projBanner = switched ? `<div class="banner banner-warn">Viewing switched project${project && project.currentRoot ? ` — <code>${esc(project.currentRoot)}</code>` : ''}. ${noObjects ? 'No governance objects resolved here — this folder may not use the Stakeport governance layout. Use the Sources lens or the read-only file viewer to inspect it.' : 'Source state is read from this project; reset restores the default.'}</div>` : '';
  return `${projBanner}<div class="banner">Dashboard lens — decisions and blockers first. Source state read ${esc(state.generatedAt)}. Controls are non-persistent; no cockpit configuration is written.</div>${strip}<div class="owidgets">${owidget(`Approvals — founder action (${approvals.length})`, 'queue', approvalsList)}${owidget(`Blockers (${blockers.length})`, 'board', blockersList)}</div><div class="owidgets">${owidget('Active goals', 'board', `<ul class="olist">${active.map((o) => `<li data-object-id="${esc(initiativeId(o))}">${pill('active', 'blue')} ${esc(fieldValue(o.name))} ${freshChip(o.freshness)}</li>`).join('') || '<li class="odim">No active initiatives.</li>'}</ul>`)}${owidget('Repo health', 'health', healthList, health.inspectedAt || '')}${owidget('Validation / audit', 'health', auditList, audit.lastRun || 'never run')}${owidget(`Stale surfaces (${stale.length})`, 'sources', staleList)}</div>${owidget('Next actions', 'queue', next.length ? `<ol class="olist onum">${next.slice(0, 8).map((n) => `<li>${esc(n)}</li>`).join('')}</ol>` : '<p class="odim">Nothing requires founder action right now.</p>')}`;
}
function renderBoard() {
  const errors = state.parseErrors.length ? `<div class="cards">${state.parseErrors.map((e) => `<article class="card error-card"><div class="card-title">Parse error</div><div class="src">${esc(e.path)} · ${esc(e.error)}</div></article>`).join('')}</div>` : '<p class="odim">No parse errors.</p>';
  return renderApprovalsBoard() + renderInitiatives() + renderWorkItems() + group('errors', 'Parse errors', errors, state.counts.parseErrors);
}

// ---------------------------------------------------------------------------
// Topology / graph lens. All data stays the existing Gate C topology output.
// ---------------------------------------------------------------------------
function isFileRef(value) { return /[\\/]/.test(value) || /\.[a-z0-9]+$/i.test(value); }
function baseName(value) { return String(value).split(/[\\/]/).pop(); }
function endpointKind(type, endpoint, direction = 'to') {
  if (isFileRef(endpoint)) return 'artifact';
  if (direction === 'from') {
    if (type === 'produces' || type === 'depends-on') return 'planned-skill';
    return 'planned-agent';
  }
  if (type === 'produces' || type === 'reads') return 'artifact';
  if (type === 'owns' || type === 'depends-on') return 'planned-skill';
  if (type === 'reports-to' || type === 'dispatches-to' || type === 'consumes-from') return 'planned-agent';
  return 'planned-skill';
}
function registerSyntheticTopologyEndpoint(endpoint) {
  const id = `topology:${endpoint.key}`;
  if (objectRegistry.has(id)) return;
  const source = endpoint.kind === 'artifact' && isFileRef(endpoint.key) ? { path: endpoint.key, locator: 'referenced topology endpoint' } : null;
  record(id, 'Topology endpoint', endpoint.label, source, {
    state: endpoint.kind.includes('planned') ? 'referenced / no definition file' : 'referenced artifact',
    owner: 'topology edge', timestamp: 'source-backed', provenance: 'Derived',
    relationships: ['Referenced by topology edge'], nextAction: source ? 'Open source evidence if allowlisted' : 'Inspect edge provenance',
    overview: [['Endpoint ID', endpoint.key], ['Kind', endpoint.kind], ['Definition file', 'not present in topology inventory']],
  });
}
function graphNodes() {
  const ids = new Set(state.topology.nodes.map((n) => n.id.value)); const nodes = state.topology.nodes.map((n) => ({ key: n.id.value, kind: fieldValue(n.nodeType, 'artifact'), label: n.id.value, ref: n })); const seen = new Set();
  const addSynthetic = (key, type, direction) => {
    if (!key || ids.has(key) || seen.has(key)) return;
    seen.add(key);
    const kind = endpointKind(type, key, direction);
    const node = { key, kind, label: kind === 'artifact' ? baseName(key) : key, ref: null };
    registerSyntheticTopologyEndpoint(node);
    nodes.push(node);
  };
  state.topology.edges.forEach((e) => {
    const type = fieldValue(e.type, '');
    const from = e.from && !e.from.nys ? e.from.value : null;
    const to = e.to && !e.to.nys ? e.to.value : null;
    addSynthetic(from, type, 'from');
    addSynthetic(to, type, 'to');
  });
  return nodes;
}
function graphLayout() {
  const nodes = graphNodes(); const columns = [[], [], []];
  nodes.forEach((n) => columns[n.kind === 'agent' || n.kind === 'planned-agent' ? 0 : n.kind === 'skill' || n.kind === 'planned-skill' ? 1 : 2].push(n));
  const positions = {}; const top = 48; const gap = 42;
  columns[0].forEach((n, i) => { positions[n.key] = { x: 250, y: top + i * gap, n }; });
  columns[1].forEach((n, i) => { positions[n.key] = { x: 620, y: top + i * gap, n }; });
  columns[2].forEach((n, i) => { positions[n.key] = { x: 970, y: top + i * gap, n }; });
  return { positions, nodes, height: Math.max(420, top + Math.max(...columns.map((c) => c.length)) * gap + 32) };
}
function graphEdges(positions) {
  // Preserve every source relationship, including duplicate logical paths with
  // distinct frontmatter evidence. Duplicate paths receive a small offset so
  // 86 source edges remain visually represented instead of being silently lost.
  const totals = new Map(); const seen = new Map(); const edges = [];
  state.topology.edges.forEach((e) => {
    if (e.from.nys || e.to.nys || e.type.nys || !positions[e.from.value] || !positions[e.to.value]) return;
    const key = `${e.from.value}|${e.to.value}|${e.type.value}`;
    totals.set(key, (totals.get(key) || 0) + 1);
  });
  state.topology.edges.forEach((e) => {
    if (e.from.nys || e.to.nys || e.type.nys || !positions[e.from.value] || !positions[e.to.value]) return;
    const key = `${e.from.value}|${e.to.value}|${e.type.value}`;
    const duplicateIndex = seen.get(key) || 0;
    seen.set(key, duplicateIndex + 1);
    edges.push({ from: e.from.value, to: e.to.value, type: e.type.value, tier: fieldValue(e.tier, 'Candidate'), duplicateIndex, duplicateTotal: totals.get(key) || 1 });
  });
  return edges;
}
function edgeClass(tier) { return tier === 'Canonical' ? 'edge-canon' : tier === 'Derived' ? 'edge-deriv' : 'edge-nys'; }
function graphNodeSvg(meta, pos) {
  const selected = view.graphSel === meta.key ? 'sel' : ''; const id = `topology:${meta.key}`;
  const left = meta.kind === 'agent' || meta.kind === 'planned-agent'; const planned = meta.kind.includes('planned');
  const labelX = left ? 14 : pos.x + 20; const anchor = left ? 'start' : 'start'; const label = esc(meta.label.length > 31 ? `${meta.label.slice(0, 30)}…` : meta.label);
  if (left) return `<g class="gnode ${selected}" data-graph-node="${esc(meta.key)}" data-object-id="${esc(id)}"><circle cx="${pos.x}" cy="${pos.y}" r="14" fill="${planned ? '#2f2740' : '#28393a'}" stroke="${planned ? '#c2a9e8' : '#7ecfd1'}" stroke-width="2"${planned ? ' stroke-dasharray="4 3"' : ''}></circle><text x="${labelX}" y="${pos.y + 4}" text-anchor="${anchor}">${label}</text></g>`;
  if (meta.kind === 'skill' || meta.kind === 'planned-skill') return `<g class="gnode ${selected}" data-graph-node="${esc(meta.key)}" data-object-id="${esc(id)}"><rect x="${pos.x - 13}" y="${pos.y - 12}" width="26" height="24" fill="${planned ? '#2f2740' : '#2c3a31'}" stroke="${planned ? '#c2a9e8' : '#6fbf8a'}" stroke-width="2"${planned ? ' stroke-dasharray="4 3"' : ''}></rect><text x="${labelX}" y="${pos.y + 4}">${label}</text></g>`;
  return `<g class="gnode ${selected}" data-graph-node="${esc(meta.key)}" data-object-id="${esc(id)}"><rect x="${pos.x - 7}" y="${pos.y - 7}" width="14" height="14" transform="rotate(45 ${pos.x} ${pos.y})" fill="#272c2e" stroke="#aeb4af" stroke-width="1.5"></rect><text x="${labelX}" y="${pos.y + 4}" class="art-label">${label}</text></g>`;
}
function renderTopology() {
  const { positions, nodes, height } = graphLayout(); const edges = graphEdges(positions); const planned = nodes.filter((n) => n.kind.includes('planned')); const artifacts = nodes.filter((n) => n.kind === 'artifact');
  const edgeSvg = edges.map((e) => { const a = positions[e.from]; const b = positions[e.to]; const hot = view.graphSel && (view.graphSel === e.from || view.graphSel === e.to); const dim = view.graphSel && !hot; const offset = (e.duplicateIndex - (e.duplicateTotal - 1) / 2) * 9; return `<path class="gedge ${edgeClass(e.tier)}${hot ? ' hot' : ''}${dim ? ' dim' : ''}" d="M ${a.x} ${a.y} C ${(a.x + b.x) / 2} ${a.y + offset}, ${(a.x + b.x) / 2} ${b.y + offset}, ${b.x} ${b.y}"></path>`; }).join('');
  const legend = `<div class="graph-legend"><span>● agent</span><span>▭ skill</span><span>⬚ planned / no definition file</span><span>◇ artifact</span><span><i class="lg-line edge-canon"></i> Canonical relationship</span><span>${nodes.length} endpoints · ${edges.length}/${state.topology.edges.length} edges drawn</span></div>`;
  const graph = `<div class="graph-wrap"><div class="graph-canvas"><svg width="1220" height="${height}" viewBox="0 0 1220 ${height}" role="img" aria-label="Complete source-backed topology graph">${edgeSvg}${Object.values(positions).map((p) => graphNodeSvg(p.n, p)).join('')}</svg></div><div class="graph-detail"><h3>${view.graphSel ? esc(objectRegistry.get(`topology:${view.graphSel}`)?.title || baseName(view.graphSel)) : 'Graph selection'}</h3><p class="odim">${view.graphSel ? 'The selected node and all source evidence are in the shared inspector.' : 'Select any node. Edges highlight, then the same inspector used by cards and tables opens.'}</p><div class="detail-sec">Coverage</div><ul class="detail-list"><li>${nodes.length} rendered endpoints</li><li>${edges.length} rendered edges</li><li>${planned.length} declared but unbuilt</li><li>${artifacts.length} input/output artifacts</li></ul></div></div>`;
  const nodeRows = nodes.map((n) => { const id = `topology:${n.key}`; const source = n.ref ? sourceInfo(n.ref.source_evidence)?.path : isFileRef(n.key) ? n.key : null; return `<tr data-object-id="${esc(id)}" class="${view.selectedObjectId === id ? 'selected' : ''}"><td>${esc(n.label)}</td><td>${esc(n.kind)}</td><td>${source ? sourceLink(source, 'source') : '—'}</td></tr>`; }).join('');
  const edgeRows = state.topology.edges.map((e, index) => { const id = `topology-edge:${index}`; const source = sourceInfo(e.source_evidence)?.path; if (!objectRegistry.has(id)) record(id, 'Topology relationship', `${fieldValue(e.from)} → ${fieldValue(e.to)}`, source ? { path: source, locator: 'definition frontmatter' } : null, { state: fieldValue(e.type), owner: fieldValue(e.from), timestamp: 'source-backed', provenance: fieldValue(e.tier), relationships: [fieldValue(e.to)], nextAction: 'Open edge source', overview: [['From', fieldValue(e.from)], ['To', fieldValue(e.to)], ['Type', fieldValue(e.type)]] }); return `<tr data-object-id="${esc(id)}" class="${view.selectedObjectId === id ? 'selected' : ''}"><td>${esc(fieldValue(e.from))}</td><td>${esc(fieldValue(e.type))}</td><td>${esc(fieldValue(e.to))}</td><td>${prov(e.tier)}</td><td>${source ? sourceLink(source, 'source') : '—'}</td></tr>`; }).join('');
  const plannedRows = planned.map((n) => `<tr data-object-id="topology:${esc(n.key)}"><td>${esc(n.label)}</td><td>${esc(n.kind)}</td><td>Referenced in definition frontmatter; no AGENT.md/SKILL.md found.</td></tr>`).join('');
  return `<div class="banner">Topology lens — graph, node list, edge list, and repository inventory project the same Gate C source-backed topology. Graph labels reserve a fixed canvas; file endpoints and all edges remain visible rather than being silently omitted.</div>${legend}${graph}${planned.length ? group('topology-planned', 'Declared but unbuilt', `<table class="grid"><tr><th>id</th><th>kind</th><th>state</th></tr>${plannedRows}</table>`, planned.length) : ''}${group('topology-nodes', 'Node list — every graph node', `<table class="grid"><tr><th>id</th><th>kind</th><th>source</th></tr>${nodeRows}</table>`, nodes.length)}${group('topology-edges', 'Edge list — every source relationship', `<table class="grid"><tr><th>from</th><th>type</th><th>to</th><th>provenance</th><th>evidence</th></tr>${edgeRows}</table>`, state.topology.edges.length)}${group('topology-inventory', 'Repository inventory — definition files', `<table class="grid"><tr><th>path</th><th>kind</th><th>frontmatter</th></tr>${state.topology.repoInventory.map((r) => `<tr data-object-id="source:${esc(r.path.value)}"><td>${esc(r.path.value)}</td><td>${esc(r.kind.value)}</td><td>${esc(String(r.hasDefinitionFrontmatter.value))}</td></tr>`).join('')}</table>`, state.topology.repoInventory.length)}`;
}

function renderRoadmap() { return `<div class="banner">Document lens — Roadmap Spine keeps product phases distinct from crawl / walk / run build maturity.</div>${group('roadmap', 'Roadmap phases', `<div class="cards">${state.roadmap.map((r) => { const id = `roadmap:${fieldValue(r.phase_label)}`; return `<article class="card click" data-object-id="${esc(id)}"><div class="card-head"><div class="card-title">${fv(r.phase_label)} ${prov(r.phase_label)}</div>${pill(fieldValue(r.target_timing), 'amber')}</div>${row('scope', r.scope_summary)}${srcLine(r.source_evidence)}</article>`; }).join('')}</div>`, state.roadmap.length)}`; }
function renderMilestones() { return `<div class="banner">Board lens — Milestone state degrades to not yet structured by contract; no completion state is guessed.</div>${group('milestones', 'Milestones', `<div class="cards">${state.milestones.map((m) => { const id = `milestone:${fieldValue(m.phase_label)}`; return `<article class="card click" data-object-id="${esc(id)}"><div class="card-head"><div class="card-title">${fv(m.phase_label)} ${prov(m.phase_label)}</div>${pill(fieldValue(m.state), 'grey')}</div>${row('target timing', m.target_timing)}${row('connected initiatives', m.connected_initiatives)}${row('scope', m.scope_summary)}${srcLine(m.source_evidence)}</article>`; }).join('')}</div>`, state.milestones.length)}`; }
function renderReview() {
  const items = state.reviews.filter((o) => matches([fieldValue(o.title), fieldValue(o.source_path), fieldValue(o.producing_agent)], o.status.nys ? null : o.status.value));
  return `<div class="banner">Document lens — internal artifacts remain reviewable and read-only. Select any artifact to open evidence through the Inspector's IDE source view.</div>${group('reviews', 'Reviewable artifacts', `<div class="cards">${items.map((o) => { const id = `review:${o.source_path.value}`; return `<article class="card click" data-object-id="${esc(id)}"><div class="card-head"><div class="card-title">${fv(o.title)}</div>${pill(fieldValue(o.status), 'grey')}</div>${row('family', o.schema_family)}${row('lifecycle', o.lifecycle_stage)}${row('producing agent', o.producing_agent)}${row('review need', o.review_need)}<div class="src">evidence: ${sourceLink(o.source_path.value)}</div></article>`; }).join('')}</div>`, `${items.length}/${state.counts.reviews}`)}`;
}
function renderLearning() { if (!state.learningSignals.length) return '<div class="banner">Dashboard lens — Candidate-tier Learning Signals have no traceable source this session, so none render. This is the required no-orphan state.</div>'; return group('learning', 'Learning signals — Candidate only', `<div class="cards">${state.learningSignals.map((o, i) => `<article class="card" data-object-id="learning:${i}"><div class="card-head"><div class="card-title">Learning signal</div>${pill('Candidate', 'amber')}</div>${row('signal', o.signal)}${row('confidence', o.confidence)}${srcLine(o.source_evidence)}</article>`).join('')}</div>`, state.learningSignals.length); }
function renderSources() { return `<div class="banner">Table lens — source map, schema family, freshness, and parse status. Each row selects the shared inspector.</div><table class="grid"><tr><th>file</th><th>family</th><th>governance type</th><th>status</th><th>freshness</th><th>role</th></tr>${state.sources.map((s) => `<tr data-object-id="source:${esc(s.path)}" class="${view.selectedObjectId === `source:${s.path}` ? 'selected' : ''}"><td>${esc(s.path)}</td><td>${esc(s.schemaFamily)}</td><td>${esc(s.governanceType || '—')}</td><td>${esc(s.fileStatus || '—')}</td><td>${s.freshness?.nys ? 'n/y/s' : `${esc(s.freshness.value.state)} ${esc(s.freshness.value.ageDays)}d/${esc(s.freshness.value.thresholdDays)}d`}</td><td>${s.rendersObjects ? 'renders objects' : 'loaded only'}</td></tr>`).join('')}</table>`; }
function renderHealth() {
  const h = repoHealth; if (!h) return '<div class="banner">Repo Health loading…</div>'; if (h.fatal) return `<article class="card error-card"><div class="card-title">Repo health error</div><p>${esc(h.fatal)}</p></article>`;
  const audit = h.audit || { everRun: false }; const status = audit.everRun ? audit.overall || 'unknown' : 'never run'; const color = status === 'pass' ? 'green' : status === 'fail' ? 'red' : 'grey';
  const workspace = `<article class="card"><div class="card-head"><div class="card-title">Workspace — read-only</div>${h.safeToProceed ? pill('safe to inspect', 'green') : pill('caution', 'amber')}</div>${row('branch', { value: h.branch || 'n/y/s', tier: 'Canonical' })}${row('working tree', { value: h.clean === null ? 'unknown' : h.clean ? 'clean' : 'dirty', tier: 'Derived' })}${row('changes', { value: `${h.counts.staged} staged · ${h.counts.unstaged} unstaged · ${h.counts.untracked} untracked`, tier: 'Canonical' })}${row('assessment', { value: h.safeReason || 'not yet structured', tier: 'Derived' })}</article>`;
  const auditCard = `<article class="card"><div class="card-head"><div class="card-title">Audit — repo-harness-auditor</div>${pill(status, color)}</div><div class="fieldrow"><span class="k">last run</span><span class="v">${esc(audit.lastRunLabel || 'never run')} ${audit.lastRun ? `(${esc(audit.lastRun)})` : ''}</span></div><div class="fieldrow"><span class="k">currency</span><span class="v">${esc(audit.freshness || 'never run')}</span></div><div class="fieldrow"><span class="k">workflow</span><span class="v">Read-only skill + harness sidecar. The cockpit never runs it.</span></div><div class="src">run externally: <span class="srclink" data-command="node tools/command-center/audit.js">node tools/command-center/audit.js</span></div></article>`;
  const commands = (h.validationCommands || []).map((c) => `<tr><td>${esc(c.label)}</td><td><span class="srclink" data-command="${esc(c.command)}">${esc(c.command)}</span></td><td>${pill(c.status, c.status === 'pass' ? 'green' : c.status === 'fail' ? 'red' : 'grey')}</td><td>${esc(c.currency)}</td><td>${esc(c.ranAtLabel || 'never run')}</td><td>${esc(c.source)}</td></tr>`).join('');
  return `<div class="banner">Repo Health is an inspection surface. It displays read-only Git state and existing audit records; it does not run commands, change files, or create a new source of truth.</div><div class="cards">${workspace}${auditCard}</div>${group('validation', 'Validation / test status', `<table class="grid"><tr><th>check</th><th>command</th><th>last result</th><th>currency</th><th>last run</th><th>source</th></tr>${commands}</table>`, (h.validationCommands || []).length)}`;
}

// ---------------------------------------------------------------------------
// Shared Inspector (region 4) and source-backed validation panel (region 5).
// ---------------------------------------------------------------------------
function renderInspector() {
  const inspector = $('#inspector'); if (!inspector) return;
  const item = objectRegistry.get(view.selectedObjectId);
  if (!item) { inspector.innerHTML = '<div class="inspector-placeholder">Select a graph node, card, or table row. The inspector shows one derived UI record over the existing source-backed object, never a duplicate truth.</div>'; return; }
  const overview = `<dl class="inspector-kv"><dt>Type</dt><dd>${esc(item.type)}</dd><dt>State</dt><dd>${esc(item.state)}</dd><dt>Owner / authority</dt><dd>${esc(item.owner)} · ${esc(item.sourceAuthority)}</dd><dt>Timestamp</dt><dd>${esc(item.timestamp)}</dd><dt>Provenance</dt><dd>${esc(item.provenance)}</dd>${item.overview.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>${item.sourcePath ? '' : '<p class="odim">No directly viewable source file is available for this derived object.</p>'}`;
  const evidence = view.evidence && view.evidence.path === item.sourcePath ? (view.evidence.loading ? '<p class="odim">Loading source evidence…</p>' : view.evidence.error ? `<pre class="evidence-content">${esc(view.evidence.error)}</pre>` : `<div class="evidence-meta">${esc(view.evidence.meta || '')} · Read-only. Edit in an editor; the cockpit never writes.</div><pre class="evidence-content">${esc(view.evidence.content || '')}</pre>`) : item.sourcePath ? `<p class="odim">Source evidence is available. Use the read-only action above to load it into this inspector.</p>` : '<p class="odim">No source file is available for this derived selection.</p>';
  const relationships = item.relationships.length ? `<ul class="detail-list">${item.relationships.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : '<p class="odim">No source-backed relationship is structured for this selection.</p>';
  const content = view.inspectorTab === 'evidence' ? evidence : view.inspectorTab === 'relationships' ? relationships : overview;
  const sourceAction = item.sourcePath ? `<button type="button" class="inspector-action" data-evidence-path="${esc(item.sourcePath)}">Load read-only source → ${esc(item.sourcePath)}</button>` : '';
  inspector.innerHTML = `<div class="inspector-head"><div class="region-label">Selected object</div><h2>${esc(item.title)}</h2><div class="inspector-id">${esc(item.id)}</div></div><div class="inspector-tabs"><button type="button" data-inspector-tab="overview" class="${view.inspectorTab === 'overview' ? 'active' : ''}">Overview</button><button type="button" data-inspector-tab="evidence" class="${view.inspectorTab === 'evidence' ? 'active' : ''}">Evidence</button><button type="button" data-inspector-tab="relationships" class="${view.inspectorTab === 'relationships' ? 'active' : ''}">Relationships</button></div><div class="inspector-body">${content}${sourceAction}<div class="detail-sec">Read-only action</div><p class="odim">${esc(item.nextAction)}</p></div>`;
  inspector.querySelectorAll('[data-inspector-tab]').forEach((button) => button.addEventListener('click', () => { view.inspectorTab = button.dataset.inspectorTab; renderInspector(); }));
  inspector.querySelectorAll('[data-evidence-path]').forEach((button) => button.addEventListener('click', () => openEvidence(button.dataset.evidencePath, item.id)));
}
function renderBottomPanel() {
  const panel = $('#bottomPanel'); if (!panel || !state) return;
  const audit = repoHealth?.audit || {}; const validation = repoHealth?.validationCommands || [];
  const sourceTraces = `<div class="bottom-section"><div class="bottom-head"><h2>Source-backed validation</h2><span>${pill(audit.everRun ? audit.overall || 'unknown' : 'never run', audit.overall === 'pass' ? 'green' : audit.overall === 'fail' ? 'red' : 'grey')}</span></div><div class="trace-row"><span>state parsed</span><b>${esc(state.generatedAt)}</b></div><div class="trace-row"><span>repo audit</span><b>${esc(audit.lastRunLabel || 'never run')} · ${esc(audit.freshness || 'unknown')}</b></div><div class="trace-row"><span>topology</span><b>${state.counts.topologyEdges} edges · ${state.counts.topologyCanonicalEdges} Canonical</b></div></div>`;
  const checks = `<div class="bottom-section"><div class="bottom-head"><h2>Validation trace</h2><span class="odim">read-only records</span></div>${validation.map((c) => `<div class="trace-row"><span>${esc(c.label)}</span><b>${esc(c.status)} · ${esc(c.currency)} · ${esc(c.ranAtLabel || 'never run')}</b></div>`).join('') || '<p class="odim">No validation status is available.</p>'}</div>`;
  const feedbackRows = view.feedback.length ? view.feedback.map((entry) => `<div class="trace-row"><span>${esc(monoTime(entry.at))}</span><b>${esc(entry.message)}</b></div>`).join('') : '<p class="odim">No shell interactions recorded this session.</p>';
  const ephemeral = `<div class="bottom-section"><div class="bottom-head"><h2>Ephemeral session feedback</h2><span class="ephemeral-note">NOT SOURCE-BACKED</span></div><p class="ephemeral-note">In-memory UI feedback only. It is not persisted and does not alter source files.</p>${feedbackRows}</div>`;
  panel.innerHTML = `<div class="bottom-grid">${sourceTraces}${checks}${ephemeral}</div>`;
}

function statusOptions() {
  const values = new Set(); if (!state) return [];
  if (view.tab === 'board' || view.tab === 'queue') state.approvals.forEach((o) => values.add(fieldValue(o.state)));
  if (view.tab === 'board') { state.strategicInitiatives.forEach((o) => values.add(fieldValue(o.status))); state.workItems.forEach((o) => values.add(fieldValue(o.status))); }
  if (view.tab === 'review') state.reviews.forEach((o) => values.add(fieldValue(o.status)));
  return [...values].sort();
}
function applyShellState() {
  const shell = $('#shell'); const lens = tabLens(view.tab);
  shell.dataset.density = view.density; shell.classList.toggle('density-compact', view.density === 'compact'); shell.classList.toggle('inspector-closed', !view.inspectorOpen); shell.classList.toggle('inspector-open', view.inspectorOpen); shell.classList.toggle('bottom-closed', !view.bottomOpen); shell.classList.toggle('sidebar-open', view.sidebarOpen);
  $('#activeLensLabel').textContent = lens; $('#lensControl').value = lens; $('#densityBtn').textContent = `Density: ${view.density}`; $('#inspectorToggle').setAttribute('aria-pressed', String(view.inspectorOpen)); $('#bottomToggle').setAttribute('aria-pressed', String(view.bottomOpen)); $('#sessionState').textContent = `IN MEMORY · ${view.density.toUpperCase()}`;
}
function render() {
  if (!state) return; applyShellState();
  document.querySelectorAll('#tabs button[data-tab]').forEach((button) => button.classList.toggle('active', button.dataset.tab === view.tab));
  const select = $('#filterStatus'); const chosen = view.filterStatus;
  select.innerHTML = '<option value="">All states</option>' + statusOptions().map((s) => `<option value="${esc(s)}"${s === chosen ? ' selected' : ''}>${esc(s)}</option>`).join('');
  $('#loadMeta').textContent = `as of ${state.asOfDate} · ${state.readOnly ? 'GET-only' : 'state unavailable'}`;
  const screens = { overview: renderOverview, board: renderBoard, queue: renderQueue, topology: renderTopology, roadmap: renderRoadmap, milestones: renderMilestones, review: renderReview, learning: renderLearning, sources: renderSources, health: renderHealth };
  $('#main').innerHTML = (screens[view.tab] || renderOverview)();
  renderInspector(); renderBottomPanel(); wireDynamic();
}
function wireDynamic() {
  const main = $('#main');
  main.querySelectorAll('[data-collapse]').forEach((el) => el.addEventListener('click', () => { view.collapsed[el.dataset.collapse] = !view.collapsed[el.dataset.collapse]; feedback(`Section ${view.collapsed[el.dataset.collapse] ? 'collapsed' : 'expanded'}: ${el.dataset.collapse}`); render(); }));
  main.querySelectorAll('[data-object-id]:not([data-graph-node])').forEach((el) => {
    // Cards, graph nodes, and data-table rows are all keyboard-reachable
    // selection controls for the shared inspector.
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    const select = (event) => { if (event.target.closest('[data-file], [data-command]')) return; selectObject(el.dataset.objectId, { graphKey: el.dataset.graphNode }); };
    el.addEventListener('click', select);
    el.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault(); select(event);
    });
  });
  // SVG groups are handled directly. This avoids relying on event-target
  // traversal across SVG child nodes and keeps graph selection identical to
  // card and table selection.
  main.querySelectorAll('[data-graph-node]').forEach((el) => {
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    const selectGraph = () => selectObject(el.dataset.objectId, { graphKey: el.dataset.graphNode });
    el.addEventListener('click', selectGraph);
    el.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault(); selectGraph();
    });
  });
  main.querySelectorAll('[data-file]').forEach((el) => el.addEventListener('click', (event) => { event.stopPropagation(); openEvidence(el.dataset.file); }));
  main.querySelectorAll('[data-command]').forEach((el) => el.addEventListener('click', (event) => { event.stopPropagation(); feedback(`Command is informational only: ${el.dataset.command}`); renderBottomPanel(); }));
  main.querySelectorAll('[data-gotab]').forEach((el) => el.addEventListener('click', (event) => { event.stopPropagation(); goTab(el.dataset.gotab); }));
}
function goTab(tab) { view.tab = tab; view.filterStatus = ''; view.graphSel = null; view.sidebarOpen = false; feedback(`Switched to ${tabLens(tab)} lens: ${tab}`); render(); }
function goLens(lens) { const spec = LENS_REGISTRY[lens]; if (!spec) return; view.tab = spec.defaultTab; view.filterStatus = ''; view.sidebarOpen = false; if (spec.inspectorMode) { view.inspectorOpen = true; view.inspectorTab = spec.inspectorMode; } feedback(`Lens selected: ${lens}`); render(); }

async function load(attempt = 0) {
  const button = $('#refreshBtn'); button.disabled = true; button.textContent = 'Refreshing…'; $('#loadMeta').textContent = 'refreshing source-backed state…';
  try {
    state = await (await fetch('/api/state', { cache: 'no-store' })).json();
    try { repoHealth = await (await fetch('/api/repo-health', { cache: 'no-store' })).json(); } catch (err) { repoHealth = { fatal: String(err) }; }
    try {
      project = await (await fetch('/api/project', { cache: 'no-store' })).json();
      if (project && project.actionToken) actionToken = project.actionToken;
    } catch (err) { project = null; }
    // Token coherence: state and repo-health are separate fetches. If the active
    // project changed between them, their root tokens differ — re-run rather than
    // render objects from one root with repo health from another.
    if (attempt < 2 && repoHealth && !repoHealth.fatal && repoHealth.rootToken && state.rootToken && repoHealth.rootToken !== state.rootToken) {
      return load(attempt + 1);
    }
    buildObjectRegistry(); updateProjectLabel(); feedback('Source-backed state refreshed'); render();
  } catch (err) {
    $('#main').innerHTML = `<article class="card error-card"><div class="card-title">Load failed</div><pre class="evidence-content">${esc(String(err))}</pre></article>`;
  } finally { button.disabled = false; button.textContent = 'Refresh'; }
}

// ---------------------------------------------------------------------------
// Project switcher. One active project per server; selection is server-side and
// survives reload/restart. No browser storage is used (V1 non-persistent UI).
// ---------------------------------------------------------------------------
function updateProjectLabel() {
  const el = $('#projectLabel'); if (!el) return;
  if (!project) { el.textContent = 'default'; el.title = ''; return; }
  el.textContent = project.isDefault ? 'default' : (project.label || 'project');
  el.title = project.currentRoot || '';
  const btn = $('#projectBtn'); if (btn) btn.classList.toggle('switched', !project.isDefault);
}
// Guarded fetch for state-changing/sensitive actions: carries the in-memory
// action token as a custom header (forces a CORS preflight cross-origin, which
// the server rejects). Never a query param; never browser storage.
async function guardedFetch(url) {
  let res = await fetch(url, { cache: 'no-store', headers: actionToken ? { 'X-Dreamfeed-Token': actionToken } : {} });
  // A 403 may mean the bootstrap token was missing/stale (e.g. the initial
  // descriptor fetch failed). Re-fetch the token once and retry before surfacing
  // an opaque permission error.
  if (res.status === 403) {
    try {
      const d = await (await fetch('/api/project', { cache: 'no-store' })).json();
      if (d && d.actionToken && d.actionToken !== actionToken) {
        actionToken = d.actionToken;
        res = await fetch(url, { cache: 'no-store', headers: { 'X-Dreamfeed-Token': actionToken } });
      }
    } catch (err) { /* fall through with the original 403 */ }
  }
  return res;
}
function renderRecent() {
  const wrap = $('#projectRecentWrap'); const list = $('#projectRecentList');
  if (!wrap || !list) return;
  const recent = (project && project.recent) || [];
  if (!recent.length) { wrap.hidden = true; list.innerHTML = ''; return; }
  wrap.hidden = false;
  list.innerHTML = recent.map((r) => `<button type="button" class="command-button project-recent-item" data-recent="${esc(r.path)}" title="${esc(r.path)}">${esc(r.label)}</button>`).join('');
  list.querySelectorAll('[data-recent]').forEach((el) => el.addEventListener('click', () => setProject(el.dataset.recent)));
}

// In-app folder browser (the explorer). Navigation only — opening a folder as the
// project is the explicit "Open this folder" action (single commit path).
function crumbSegments(p) {
  const sep = p.includes('\\') ? '\\' : '/';
  const norm = p.replace(/[\\/]+$/, '');
  const parts = norm.split(sep);
  const segs = []; let acc = '';
  parts.forEach((part, i) => {
    if (i === 0) acc = part === '' ? sep : (part.endsWith(':') ? part + sep : part);
    else acc = (acc.endsWith(sep) ? acc : acc + sep) + part;
    segs.push({ label: part || sep, path: acc });
  });
  return segs;
}
function browseError(msg) {
  const errEl = $('#projectError'); const listEl = $('#pbList');
  if (listEl) listEl.innerHTML = `<div class="pb-empty">${esc(msg)}</div>`;
  if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
}
async function browseTo(p) {
  try {
    const res = await guardedFetch('/api/dirs?path=' + encodeURIComponent(p || ''));
    if (res.status === 404) {
      // The /api/dirs route is missing — the running server predates it. Static
      // files are read from disk per request, but routes need a process restart.
      browseError('Folder browsing route not found — restart the cockpit server (stop it and run "npm start" again), then reopen this dialog.');
      return;
    }
    let data;
    try { data = await res.json(); }
    catch { browseError(`Unexpected response (HTTP ${res.status}) from /api/dirs — restart the server and hard-refresh.`); return; }
    if (data.error) { browseError(data.error); return; }
    const errEl = $('#projectError'); if (errEl) errEl.hidden = true;
    browse = data;
    renderBrowser();
  } catch (err) {
    browseError(String(err && err.message || err));
  }
}
function renderBrowser() {
  const crumbsEl = $('#pbCrumbs'); const listEl = $('#pbList'); const hereEl = $('#pbHere'); const upEl = $('#pbUp');
  if (!crumbsEl || !listEl || !browse) return;
  crumbsEl.innerHTML = crumbSegments(browse.path).map((s) =>
    `<button type="button" class="pb-crumb" data-crumb="${esc(s.path)}" title="${esc(s.path)}">${esc(s.label)}</button>`).join('<span class="pb-sep">›</span>');
  const drives = (browse.drives || []).map((d) =>
    `<button type="button" class="pb-item pb-drive" data-dir="${esc(d)}"><span class="pb-item-icon">💽</span><span class="pb-item-name">${esc(d)}</span></button>`).join('');
  const folders = browse.entries.length
    ? browse.entries.map((e) => `<button type="button" class="pb-item" data-dir="${esc(e.path)}" title="${esc(e.path)}"><span class="pb-item-icon">📁</span><span class="pb-item-name">${esc(e.name)}</span></button>`).join('')
    : '<div class="pb-empty">No subfolders.</div>';
  listEl.innerHTML = (drives ? `<div class="pb-drives">${drives}</div>` : '') + folders;
  hereEl.innerHTML = `Open <code>${esc(browse.path)}</code>${browse.looksLikeRepo ? ' <span class="pb-ok">· looks like a governance repo</span>' : ''}`;
  upEl.disabled = !browse.parent;
  crumbsEl.querySelectorAll('[data-crumb]').forEach((el) => el.addEventListener('click', () => browseTo(el.dataset.crumb)));
  listEl.querySelectorAll('[data-dir]').forEach((el) => el.addEventListener('click', () => browseTo(el.dataset.dir)));
}
function openProjectDialog() {
  const dlg = $('#projectDialog'); if (!dlg) return;
  $('#projectDialogCurrent').textContent = project ? project.currentRoot : '—';
  $('#projectPath').value = project && !project.isDefault ? project.currentRoot : '';
  // Native picker is the primary action when the server reports it available.
  const native = !!(project && project.pickers && project.pickers.native);
  $('#projectSelectFolder').hidden = !native;
  $('#projectSelectHint').hidden = !native;
  renderRecent();
  // Start the in-app explorer at the active project folder.
  browse = null; $('#pbList').innerHTML = '<div class="pb-empty">Loading…</div>';
  browseTo(project ? project.currentRoot : '');
  const errEl = $('#projectError'); errEl.hidden = true; errEl.textContent = '';
  const warnEl = $('#projectWarn');
  const warn = project && (
    project.restoreWarning
    || (project.persistWarning ? `Not saved for next launch (${project.persistWarning}) — the project will revert to default on restart.` : '')
    || (!project.isDefault && !project.looksLikeRepo ? 'This folder has no agents/ or CLAUDE.md — it may not be a governance repo.' : '')
  );
  if (warn) { warnEl.textContent = warn; warnEl.hidden = false; } else { warnEl.hidden = true; }
  if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
}
function closeProjectDialog() {
  const dlg = $('#projectDialog'); if (!dlg) return;
  if (typeof dlg.close === 'function' && dlg.open) dlg.close(); else dlg.removeAttribute('open');
}
async function selectFolder() {
  const errEl = $('#projectError'); const btn = $('#projectSelectFolder');
  if (btn) { btn.disabled = true; btn.textContent = 'Opening picker…'; }
  try {
    const res = await guardedFetch('/api/select-folder');
    const data = await res.json();
    if (data && data.path) { await setProject(data.path); return; }
    if (data && data.cancelled) { feedback('Folder selection cancelled — project unchanged'); return; }
    if (errEl && data && data.error) { errEl.textContent = data.error; errEl.hidden = false; }
  } catch (err) {
    if (errEl) { errEl.textContent = String(err); errEl.hidden = false; }
  } finally { if (btn) { btn.disabled = false; btn.textContent = 'Select folder…'; } }
}
async function setProject(pathValue) {
  const errEl = $('#projectError');
  const target = pathValue || (project && project.default) || '';
  try {
    const res = await guardedFetch('/api/project?root=' + encodeURIComponent(target));
    const data = await res.json();
    if (data.error) { if (errEl) { errEl.textContent = data.error; errEl.hidden = false; } return false; }
    project = data;
    if (data.actionToken) actionToken = data.actionToken;
    // A new project invalidates any selection/evidence from the previous one.
    view.selectedObjectId = null; view.evidence = null; view.graphSel = null;
    feedback(`Switched project: ${data.isDefault ? 'default' : data.currentRoot}`);
    if (data.persistWarning) feedback(`Note: project not saved for next launch — ${data.persistWarning}`);
    closeProjectDialog();
    await load();
    return true;
  } catch (err) {
    if (errEl) { errEl.textContent = String(err); errEl.hidden = false; }
    return false;
  }
}
function bindShell() {
  $('#tabs').addEventListener('click', (event) => { const button = event.target.closest('button[data-tab]'); if (button) goTab(button.dataset.tab); });
  $('#filterText').addEventListener('input', (event) => { view.filterText = event.target.value; render(); });
  $('#filterStatus').addEventListener('change', (event) => { view.filterStatus = event.target.value; render(); });
  $('#lensControl').addEventListener('change', (event) => goLens(event.target.value));
  $('#refreshBtn').addEventListener('click', () => load());
  $('#projectBtn').addEventListener('click', openProjectDialog);
  $('#pbUp').addEventListener('click', () => { if (browse && browse.parent) browseTo(browse.parent); });
  $('#pbUse').addEventListener('click', () => { if (browse) setProject(browse.path); });
  $('#projectSelectFolder').addEventListener('click', selectFolder);
  $('#projectSwitch').addEventListener('click', () => setProject($('#projectPath').value.trim()));
  $('#projectReset').addEventListener('click', () => setProject(''));
  $('#projectCancel').addEventListener('click', closeProjectDialog);
  $('#projectPath').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); setProject($('#projectPath').value.trim()); } });
  $('#densityBtn').addEventListener('click', () => { view.density = view.density === 'comfortable' ? 'compact' : 'comfortable'; feedback(`Density set to ${view.density}`); render(); });
  $('#inspectorToggle').addEventListener('click', () => { view.inspectorOpen = !view.inspectorOpen; feedback(`Inspector ${view.inspectorOpen ? 'shown' : 'hidden'}`); render(); });
  $('#bottomToggle').addEventListener('click', () => { view.bottomOpen = !view.bottomOpen; feedback(`Validation panel ${view.bottomOpen ? 'shown' : 'hidden'}`); render(); });
  $('#sidebarToggle').addEventListener('click', () => { view.sidebarOpen = !view.sidebarOpen; render(); });
  $('#logo').addEventListener('click', () => goTab('overview'));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { view.sidebarOpen = false; if (window.innerWidth <= 940) view.inspectorOpen = false; render(); } });
}

bindShell();
load();
