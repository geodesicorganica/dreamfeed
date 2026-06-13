'use strict';
// Dreamfeed cockpit frontend. View state is in memory only (FR16); the only
// network calls are GET /api/state, /api/repo-health, /api/file. Nothing is
// written back to the server or repo.

let state = null;
let repoHealth = null;
const view = { tab: 'overview', filterText: '', filterStatus: '', collapsed: {}, graphSel: null };

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---- field/provenance helpers ----
function fv(f) {
  if (!f) return '<span class="nys">—</span>';
  if (f.nys) return '<span class="nys">not yet structured</span>';
  return typeof f.value === 'object' ? esc(JSON.stringify(f.value)) : esc(f.value);
}
function prov(f) { return f && f.tier ? `<span class="prov prov-${f.tier}">${f.tier === 'Candidate' ? 'Cand' : f.tier}</span>` : ''; }
function row(k, f) { if (f === undefined) return ''; return `<div class="fieldrow"><span class="k">${esc(k)}</span><span class="v">${fv(f)} ${prov(f)}</span></div>`; }
function pill(label, kind) { return `<span class="pill pill-${kind}">${esc(label)}</span>`; }
function freshChip(f) {
  if (!f || f.nys) return `<span class="freshchip amber">freshness: n/y/s</span>`;
  const v = f.value; return `<span class="freshchip ${v.state}">${v.state} ${v.ageDays}d/${v.thresholdDays}d</span>`;
}
function srcLine(f, extraFiles) {
  let html = '';
  if (f && !f.nys) html += `<span class="srclink" data-file="${esc(f.value.file)}">${esc(f.value.file)}</span> — ${esc(f.value.locator)}`;
  (extraFiles || []).forEach(p => { html += ` · <span class="srclink" data-file="${esc(p)}">${esc(p)}</span>`; });
  return html ? `<div class="src">source: ${html}</div>` : '';
}
function group(key, title, inner, count) {
  const c = !!view.collapsed[key];
  return `<section class="group"><div class="group-head" data-collapse="${key}"><span class="chev">${c ? '▶' : '▼'}</span><h2>${esc(title)}</h2><span class="count">${count}</span></div><div class="${c ? 'hidden' : ''}">${inner}</div></section>`;
}
function fileTokens(...texts) {
  const set = new Set();
  const re = /[A-Za-z0-9_./-]+\.(?:md|json|js|html|css|txt)/g;
  for (const t of texts) { if (!t) continue; const m = String(t).match(re); if (m) m.forEach(x => set.add(x.replace(/[`),.]+$/, ''))); }
  return [...set];
}

// ---- filters ----
function matches(texts, statusVal) {
  if (view.filterText && !texts.join(' ').toLowerCase().includes(view.filterText.toLowerCase())) return false;
  if (view.filterStatus && (statusVal || 'not yet structured') !== view.filterStatus) return false;
  return true;
}

// ===========================================================================
// Strategic Initiative health (B4) — derived in the UI from status + freshness.
// Source files carry no target-date / health field → target renders n/y/s.
// ===========================================================================
function initiativeHealth(o) {
  const s = o.status.nys ? null : o.status.value;
  const stale = o.freshness && !o.freshness.nys && o.freshness.value.state === 'stale';
  if (s === 'complete') return { bucket: 'Completed', label: 'completed', kind: 'green' };
  if (s === 'active') return stale ? { bucket: 'Behind', label: 'behind (stale)', kind: 'amber' } : { bucket: 'Active', label: 'active / on-track', kind: 'blue' };
  if (s === 'paused') return { bucket: 'Paused / Queued', label: 'paused', kind: 'grey' };
  if (s === 'proposed') return { bucket: 'Paused / Queued', label: 'queued', kind: 'grey' };
  return { bucket: 'Other', label: 'not yet structured', kind: 'amber' };
}
function initiativeCard(o) {
  const h = initiativeHealth(o);
  return `<div class="card">
    <div class="card-head"><div><div class="card-title">${esc(o.name.value)}</div>
      <div class="card-sub">${esc(o.owner.nys ? '' : o.owner.value)} · stage ${esc(o.stage.value)}${o.manual_flag && o.manual_flag.value ? ' · manual' : ''}</div></div>
      <div style="text-align:right">${pill(h.label, h.kind)}<div style="margin-top:5px">${freshChip(o.freshness)}</div></div></div>
    ${row('status', o.status)}
    ${o.status_note ? row('detail', o.status_note) : ''}
    <div class="fieldrow"><span class="k">target date</span><span class="v"><span class="nys">not yet structured</span> <span class="prov prov-Derived">no source field</span></span></div>
    ${row('success def', o.success_definition)}
    ${srcLine(o.source_evidence)}
  </div>`;
}
function renderInitiatives() {
  const items = state.strategicInitiatives.filter(o => matches([o.name.value, o.owner.value, o.status_note ? o.status_note.value : ''], o.status.nys ? null : o.status.value));
  const buckets = ['Active', 'Behind', 'Paused / Queued', 'Completed', 'Other'];
  let html = '';
  for (const b of buckets) {
    const inB = items.filter(o => initiativeHealth(o).bucket === b);
    if (!inB.length) continue;
    html += `<div class="detail-sec">${esc(b)} — ${inB.length}</div><div class="cards">${inB.map(initiativeCard).join('')}</div>`;
  }
  return group('si', 'Strategic Initiatives', html || '<p style="color:var(--type-muted)">none</p>', `${items.length}/${state.counts.strategicInitiatives}`);
}

// ===========================================================================
// Work Items (B5) — Kanban by status, keeps "week of".
// ===========================================================================
function renderWorkItems() {
  const items = state.workItems.filter(o => matches([o.rank.value, o.action.value, o.initiative.value], o.status.nys ? null : o.status.value));
  const cols = [
    { key: 'active', t: 'Active', kind: 'blue' },
    { key: 'blocked', t: 'Blocked', kind: 'red' },
    { key: 'queued', t: 'Queued', kind: 'grey' },
    { key: 'completed', t: 'Completed', kind: 'green' },
    { key: 'nys', t: 'Not yet structured', kind: 'amber' },
  ];
  const week = state.workItems[0] && !state.workItems[0].sprint_week.nys ? state.workItems[0].sprint_week.value : 'n/y/s';
  const colHtml = cols.map(c => {
    const inC = items.filter(o => (o.status.nys ? 'nys' : o.status.value) === c.key);
    if (!inC.length) return '';
    const cards = inC.map(o => `<div class="kitem">
        <div class="kt">${esc(o.rank.value)} · ${esc(o.action.value.slice(0, 90))}${o.action.value.length > 90 ? '…' : ''}</div>
        <div class="km">${esc(o.owner.value)} · ${esc(o.estimate.value)} · ${esc(o.initiative.value.slice(0, 40))}</div>
        ${o.status_note ? `<div class="km" style="margin-top:4px">${esc(o.status_note.value.slice(0, 90))}</div>` : ''}
      </div>`).join('');
    return `<div class="kcol"><div class="kcol-head"><span class="t">${pill(c.t, c.kind)}</span><span class="n">${inC.length}</span></div>${cards}</div>`;
  }).join('');
  return group('wi', `Work Items — week of ${esc(week)}`, `<div class="kanban">${colHtml || '<p style="color:var(--type-muted)">none</p>'}</div>`, `${items.length}/${state.counts.workItems}`);
}

// ===========================================================================
// Approvals (B6 deep-review, B7 ordering/split).
// ===========================================================================
function approvalCard(o) {
  const isDecision = o.source_kind.value === 'decision';
  const title = isDecision ? `${o.id.nys ? '?' : esc(o.id.value)} · decision` : `${o.id.nys ? 'dispatch gate' : esc(o.id.value)}`;
  const stateKind = ({ open: 'amber', conditional: 'blue', pending: 'grey', resolved: 'grey', transmitted: 'grey' })[o.state.nys ? '' : o.state.value] || 'grey';
  const refFiles = fileTokens(
    o.decision ? o.decision.value : '', o.information_needed ? o.information_needed.value : '',
    o.title && !o.title.nys ? o.title.value : '', o.gate_condition && !o.gate_condition.nys ? o.gate_condition.value : '');
  const primaryFile = o.source_evidence && !o.source_evidence.nys ? o.source_evidence.value.file : null;
  const localHint = /command-center|cockpit|dreamfeed/i.test(JSON.stringify(o))
    ? `<div class="src">view locally: <span class="srclink" data-cmd="1">cd tools/command-center &amp;&amp; npm start</span> → http://127.0.0.1:4173/</div>` : '';
  return `<div class="card click" ${primaryFile ? `data-open="${esc(primaryFile)}"` : ''}>
    <div class="card-head"><div class="card-title">${title}</div><div style="text-align:right">${pill(o.state.nys ? 'n/y/s' : o.state.value, stateKind)}<div style="margin-top:5px">${freshChip(o.freshness)}</div></div></div>
    ${o.decision ? row('decision', o.decision) : ''}
    ${o.title ? row('gate', o.title) : ''}
    ${o.gate_condition ? row('condition', o.gate_condition) : ''}
    ${o.consequence_if_deferred ? row('if deferred', o.consequence_if_deferred) : ''}
    ${o.decision_maker ? row('decided by', o.decision_maker) : ''}
    ${o.information_needed ? row('info needed', o.information_needed) : ''}
    ${o.target_agent ? row('agent', o.target_agent) : ''}
    ${o.initiative ? row('initiative', o.initiative) : ''}
    ${o.resolution_date ? row('resolved', o.resolution_date) : ''}
    <div class="src">${primaryFile ? `open for review: <span class="srclink" data-file="${esc(primaryFile)}">${esc(primaryFile)}</span>` : 'no source file'}${refFiles.filter(f => f !== primaryFile).map(f => ` · <span class="srclink" data-file="${esc(f)}">${esc(f)}</span>`).join('')}</div>
    ${localHint}
  </div>`;
}
function isOpenApproval(o) { return ['open', 'conditional', 'pending'].includes(o.state.nys ? '' : o.state.value); }
function renderApprovalsBoard() {
  const open = state.approvals.filter(isOpenApproval).filter(o => matches([o.id && !o.id.nys ? o.id.value : '', o.decision ? o.decision.value : '', o.initiative && !o.initiative.nys ? o.initiative.value : ''], o.state.nys ? null : o.state.value));
  return group('ap', 'Approvals — needs founder action', `<div class="cards">${open.map(approvalCard).join('') || '<p style="color:var(--type-muted)">no open approvals</p>'}</div>`, `${open.length} open / ${state.counts.approvalsTotal} total`);
}
function renderQueue() {
  const all = state.approvals.filter(o => matches([o.id && !o.id.nys ? o.id.value : '', o.decision ? o.decision.value : '', o.title && !o.title.nys ? o.title.value : '', o.initiative && !o.initiative.nys ? o.initiative.value : ''], o.state.nys ? null : o.state.value));
  const open = all.filter(isOpenApproval);
  const past = all.filter(o => !isOpenApproval(o));
  const banner = `<div class="banner">Approval Queue (FR10) — <b>${open.length}</b> open/active (need founder action) · <b>${past.length}</b> resolved/transmitted (history, below). Click any card to open its source artifact for review. Read-only: decide in the source files.</div>`;
  return banner
    + group('q-open', 'Open / active approvals', `<div class="cards">${open.map(approvalCard).join('') || '<p style="color:var(--type-muted)">none open</p>'}</div>`, open.length)
    + group('q-past', 'Resolved / transmitted (history)', `<div class="cards">${past.map(approvalCard).join('') || '<p style="color:var(--type-muted)">none</p>'}</div>`, past.length);
}

// ===========================================================================
// Overview / Home (gate 5b r2) — default daily-use operating cockpit.
// Composes existing state + repoHealth (no new endpoint). High-priority
// decisions/blockers first, then status widgets; every widget links to a tab.
// ===========================================================================
function navlink(tab, label) { return `<span class="navlink" data-gotab="${esc(tab)}">${esc(label || 'open')} →</span>`; }
function tile(big, label, kind, tab) {
  return `<div class="otile otile-${kind}"${tab ? ` data-gotab="${esc(tab)}"` : ''}>
    <div class="otile-big">${esc(String(big))}</div><div class="otile-label">${esc(label)}</div></div>`;
}
function owidget(title, tab, inner, ts) {
  return `<div class="owidget"><div class="owidget-head"><h3>${esc(title)}</h3>${tab ? navlink(tab) : ''}</div>
    ${ts ? `<div class="owidget-ts">${esc(ts)}</div>` : ''}${inner}</div>`;
}
function renderOverview() {
  const open = state.approvals.filter(isOpenApproval);
  const blockers = state.workItems.filter(o => !o.status.nys && o.status.value === 'blocked');
  const activeInit = state.strategicInitiatives.filter(o => !o.status.nys && o.status.value === 'active');
  const staleSrc = state.sources.filter(s => s.freshness && !s.freshness.nys && s.freshness.value.state === 'stale');
  const h = repoHealth || {};
  const a = (h && h.audit) || { everRun: false };

  // Priority strip — at-a-glance counts; action items use alarm colours.
  const strip = `<div class="otiles">
    ${tile(open.length, 'open approvals', open.length ? 'amber' : 'green', 'queue')}
    ${tile(blockers.length, 'blockers', blockers.length ? 'red' : 'green', 'board')}
    ${tile(activeInit.length, 'active goals', 'blue', 'board')}
    ${tile(h.clean === false ? 'dirty' : (h.clean === true ? 'clean' : '—'), 'workspace', h.clean === false ? 'amber' : 'green', 'health')}
    ${tile(a.everRun ? (a.overall || '—') : 'never run', 'last audit', a.overall === 'pass' ? 'green' : a.overall === 'fail' ? 'red' : 'grey', 'health')}
  </div>`;

  // Needs-action widgets — approvals + blockers, above general browsing.
  const apprList = open.length
    ? `<ul class="olist">${open.slice(0, 6).map(o => `<li>${pill(o.state.nys ? 'n/y/s' : o.state.value, 'amber')} <span class="srclink"${o.source_evidence && !o.source_evidence.nys ? ` data-file="${esc(o.source_evidence.value.file)}"` : ''}>${esc(o.id && !o.id.nys ? o.id.value : (o.title && !o.title.nys ? o.title.value : 'approval'))}</span> <span class="odim">${esc((o.decision && !o.decision.nys ? o.decision.value : (o.title && !o.title.nys ? o.title.value : '')).slice(0, 90))}</span></li>`).join('')}</ul>`
    : `<p class="odim">No open approvals.</p>`;
  const blkList = blockers.length
    ? `<ul class="olist">${blockers.map(o => `<li>${pill('blocked', 'red')} <b>${esc(o.rank.value)}</b> ${esc(o.action.value.slice(0, 80))} <span class="odim">${o.status_note && !o.status_note.nys ? esc(o.status_note.value.slice(0, 80)) : ''}</span></li>`).join('')}</ul>`
    : `<p class="odim">No blockers.</p>`;
  const action = `<div class="owidgets">
    ${owidget(`Approvals — needs founder action (${open.length})`, 'queue', apprList)}
    ${owidget(`Blockers (${blockers.length})`, 'board', blkList)}
  </div>`;

  // Status widgets.
  const initList = activeInit.length
    ? `<ul class="olist">${activeInit.map(o => `<li>${pill('active', 'blue')} ${esc(o.name.value)} ${freshChip(o.freshness)}</li>`).join('')}</ul>`
    : `<p class="odim">No active initiatives.</p>`;

  const lc = h.lastCommit ? `${esc(h.lastCommit.hash)} · ${esc(h.lastCommit.subject)}` : 'n/y/s';
  const healthInner = `<div class="okv"><span>branch</span><b>${esc(h.branch || '—')}</b></div>
    <div class="okv"><span>workspace</span><b>${h.clean === null || h.clean === undefined ? 'unknown' : (h.clean ? 'clean' : 'dirty')}</b></div>
    <div class="okv"><span>staged / unstaged / untracked</span><b>${h.counts ? `${h.counts.staged} / ${h.counts.unstaged} / ${h.counts.untracked}` : '—'}</b></div>
    <div class="okv"><span>last commit</span><b>${lc}</b></div>`;
  const healthTs = h.lastCommit ? `last commit ${esc(h.lastCommit.dateLabel || h.lastCommit.date || '')}` : '';

  const auditInner = a.everRun
    ? `<div class="okv"><span>result</span><b>${pill(a.overall || '—', a.overall === 'pass' ? 'green' : a.overall === 'fail' ? 'red' : 'grey')}</b></div>
       <div class="okv"><span>currency</span><b>${esc(a.freshness || '—')}</b></div>
       <div class="okv"><span>checks</span><b>${(h.validationCommands || []).length} validation/test commands</b></div>`
    : `<p class="odim">Audit never run — <span class="srclink" data-cmd="1">node tools/command-center/audit.js</span></p>`;
  const auditTs = a.everRun ? `last run ${esc(a.lastRunLabel || '')} (${esc(a.lastRun || '')})` : 'never run';

  const phaseNow = state.roadmap.find(r => !r.target_timing.nys && /now/i.test(r.target_timing.value)) || state.roadmap[0];
  const msInner = phaseNow
    ? `<div class="okv"><span>current phase</span><b>${fv(phaseNow.phase_label)}</b></div><p class="odim">${esc((phaseNow.scope_summary.value || '').slice(0, 150))}</p><p class="odim">Milestone state is not-yet-structured by contract (never inferred complete).</p>`
    : `<p class="odim">No roadmap phase parsed.</p>`;

  const staleInner = staleSrc.length
    ? `<ul class="olist">${staleSrc.map(s => `<li>${pill('stale', 'red')} <span class="srclink" data-file="${esc(s.path)}">${esc(s.path)}</span> <span class="odim">${s.freshness.value.ageDays}d / ${s.freshness.value.thresholdDays}d${s.dateModified ? ' · modified ' + esc(s.dateModified) : ''}</span></li>`).join('')}</ul>`
    : `<p class="odim">No stale source files.</p>`;

  const status = `<div class="owidgets">
    ${owidget('Active goals', 'board', initList)}
    ${owidget('Repo health', 'health', healthInner, healthTs)}
    ${owidget('Validation / audit', 'health', auditInner, auditTs)}
    ${owidget('Current milestone', 'milestones', msInner)}
    ${owidget(`Stale surfaces (${staleSrc.length})`, 'sources', staleInner)}
  </div>`;

  // Next actions — derived from open approvals + blockers.
  const next = [
    ...open.map(o => `Review / approve ${o.id && !o.id.nys ? o.id.value : (o.title && !o.title.nys ? o.title.value : 'approval')}`),
    ...blockers.map(o => `Unblock ${o.rank.value}: ${o.action.value.slice(0, 70)}`),
  ];
  const nextInner = next.length
    ? `<ol class="olist onum">${next.slice(0, 8).map(t => `<li>${esc(t)}</li>`).join('')}</ol>`
    : `<p class="odim">Nothing requires founder action right now.</p>`;

  const banner = `<div class="banner">Overview — daily operating cockpit. Decisions and blockers first, then status. Read-only; click any source link to open it, or a widget header to jump to its tab. As of ${esc(state.asOfDate)} · loaded ${new Date(state.generatedAt).toLocaleTimeString()}.</div>`;
  return banner + strip + action + status + owidget('Next actions', null, nextInner);
}

// ===========================================================================
// OS State Board — approvals ABOVE initiatives (B7), then work items, errors.
// ===========================================================================
function renderBoard() {
  const errHtml = state.parseErrors.length
    ? `<div class="cards">${state.parseErrors.map(e => `<div class="card error-card"><div class="card-title">parse error</div>${row('file', { value: e.path, tier: 'Derived' })}${row('error', { value: e.error, tier: 'Derived' })}</div>`).join('')}</div>`
    : '<p style="color:var(--type-muted);font-size:12px">No parse errors.</p>';
  return renderApprovalsBoard() + renderInitiatives() + renderWorkItems() + group('err', 'Parse errors', errHtml, state.counts.parseErrors);
}

// ===========================================================================
// Topology Map (B1) — real SVG node/edge graph + click-through detail.
// ===========================================================================
const VBW = 760, VBH = 560;
function graphLayout() {
  const t = state.topology;
  const agents = t.nodes.filter(n => n.nodeType === 'agent');
  const skills = t.nodes.filter(n => n.nodeType === 'skill');
  const pos = {};
  agents.forEach((n, i) => { pos[n.id.value] = { x: 150, y: 70 + i * ((VBH - 140) / Math.max(1, agents.length - 1)), node: n }; });
  skills.forEach((n, i) => { pos[n.id.value] = { x: 600, y: 45 + i * ((VBH - 90) / Math.max(1, skills.length - 1)), node: n }; });
  return pos;
}
function dedupeNodeEdges(pos) {
  const t = state.topology, seen = new Set(), out = [];
  for (const e of t.edges) {
    if (!e.from || e.from.nys || !e.to || e.to.nys || !e.type || e.type.nys) continue;
    const from = e.from.value, to = e.to.value, type = e.type.value;
    if (!pos[from] || !pos[to]) continue; // only node-to-node edges (file edges shown in detail)
    const key = `${from}|${to}|${type}`;
    if (seen.has(key)) continue; seen.add(key);
    out.push({ from, to, type, tier: e.tier && !e.tier.nys ? e.tier.value : null, ev: e.source_evidence && !e.source_evidence.nys ? e.source_evidence.value : null });
  }
  return out;
}
function edgeClass(tier) { return tier === 'Canonical' ? 'edge-canon' : tier === 'Derived' ? 'edge-deriv' : 'edge-nys'; }
function renderTopology() {
  const t = state.topology;
  const pos = graphLayout();
  const edges = dedupeNodeEdges(pos);
  const sel = view.graphSel;
  const edgeSvg = edges.map(e => {
    const a = pos[e.from], b = pos[e.to];
    const touches = sel && (e.from === sel || e.to === sel);
    const cls = `gedge ${edgeClass(e.tier)} ${sel ? (touches ? 'hot' : 'dim') : ''}`;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 40;
    return `<path class="${cls}" d="M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}"></path>`;
  }).join('');
  const nodeSvg = t.nodes.map(n => {
    const p = pos[n.id.value]; if (!p) return '';
    const isAgent = n.nodeType === 'agent';
    const selCls = sel === n.id.value ? 'sel' : '';
    const planned = n.status && !n.status.nys && n.status.value === 'planned';
    const fill = isAgent ? (planned ? '#2a2140' : '#1B3B8A') : (planned ? '#2a2140' : '#16324f');
    const stroke = isAgent ? '#2D6FE8' : '#18C08A';
    const label = esc(n.id.value);
    if (isAgent) {
      return `<g class="gnode ${selCls}" data-node="${esc(n.id.value)}"><circle cx="${p.x}" cy="${p.y}" r="22" fill="${fill}" stroke="${stroke}" stroke-width="2"></circle><text x="${p.x - 30}" y="${p.y + 4}" text-anchor="end">${label}</text></g>`;
    }
    return `<g class="gnode ${selCls}" data-node="${esc(n.id.value)}"><rect x="${p.x - 14}" y="${p.y - 13}" width="28" height="26" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="2"></rect><text x="${p.x + 24}" y="${p.y + 4}">${label}</text></g>`;
  }).join('');
  const legend = `<div class="graph-legend">
    <span><i class="lg-line" style="border-color:var(--green)"></i> Canonical</span>
    <span><i class="lg-line" style="border-color:var(--vortex-soft)"></i> Derived</span>
    <span><i class="lg-line" style="border-color:var(--amber)"></i> not-yet-structured</span>
    <span>● agent &nbsp; ▭ skill &nbsp; (violet = planned)</span>
    <span>${t.nodes.length} nodes · ${edges.length} graph edges (${t.tally.Canonical} Canonical / ${t.tally.Derived} Derived / ${t.tally.nys} n-y-s total)</span></div>`;
  const detail = renderGraphDetail(sel);

  // ---- Restored structured lists below the graph (gate 5b r2 B1) + accuracy
  // panel (B2). The graph is an additional visualization layer, not a
  // replacement: the lists below carry ALL nodes and ALL edges, including the
  // file-target edges the node graph cannot draw.
  const ids = new Set(t.nodes.map(n => n.id.value));
  let fileEdges = 0;
  for (const e of t.edges) { const to = e.to && !e.to.nys ? e.to.value : null; if (!(to && ids.has(to))) fileEdges++; }
  const accuracy = `<div class="banner">Topology coverage (verified against source): <b>${t.nodes.length} nodes</b> (${t.nodes.filter(n => n.nodeType === 'agent').length} agents / ${t.nodes.filter(n => n.nodeType === 'skill').length} skills) · <b>${t.edges.length} edges</b> (${t.tally.Canonical} Canonical / ${t.tally.Derived} Derived / ${t.tally.nys} not-yet-structured) · <b>${edges.length} drawn in graph</b> (node→node) · <b>${fileEdges} file-target edges</b> listed below but <b>not drawn</b> in the graph (their target is a file path, not an agent/skill node). 0 prose-only (Derived) edges: this build reads Phase 0b definition-file frontmatter only (Gate C Amendment 1) and does not scan prose — any relationship that exists only in prose is not represented here. Parse errors: ${state.parseErrors.filter(e => /AGENT\.md|SKILL\.md/.test(e.path || '')).length} on definition files. All source files are clickable.</div>`;

  const nodeRows = t.nodes.map(n => `<tr>
    <td>${esc(n.id.value)}</td><td>${esc(n.nodeType)}</td>
    <td>${esc(n.name.nys ? '—' : n.name.value)}</td>
    <td>${n.nodeType === 'agent' ? esc(n.layer.nys ? '—' : n.layer.value) : esc(n.owning_agent.nys ? '—' : n.owning_agent.value)}</td>
    <td>${esc(n.status.nys ? 'n/y/s' : n.status.value)}</td>
    <td>${n.source_evidence && !n.source_evidence.nys ? `<span class="srclink" data-file="${esc(n.source_evidence.value.file)}">${esc(n.source_evidence.value.file)}</span>` : '—'}</td></tr>`).join('');
  const nodeList = group('topo-nodes', 'Node list', `<table class="grid"><tr><th>id</th><th>type</th><th>name</th><th>layer / owner</th><th>status</th><th>source</th></tr>${nodeRows}</table>`, t.nodes.length);

  const edgeRows = t.edges.map(e => {
    const from = e.from && !e.from.nys ? e.from.value : '—';
    const to = e.to && !e.to.nys ? e.to.value : 'not-yet-structured';
    const type = e.type && !e.type.nys ? e.type.value : '—';
    const tier = e.tier && !e.tier.nys ? e.tier.value : 'n-y-s';
    const targetKind = (e.to && !e.to.nys && ids.has(e.to.value)) ? 'node' : (e.to && !e.to.nys ? 'file' : '—');
    const provCls = tier === 'Canonical' ? 'Canonical' : tier === 'Derived' ? 'Derived' : 'Candidate';
    const ev = e.source_evidence && !e.source_evidence.nys ? e.source_evidence.value.file : null;
    return `<tr><td>${esc(from)}</td><td><b>${esc(type)}</b></td><td>${esc(to)}</td><td><span class="pill pill-${targetKind === 'node' ? 'blue' : targetKind === 'file' ? 'grey' : 'amber'}">${esc(targetKind)}</span></td><td><span class="prov prov-${provCls}">${esc(tier)}</span></td><td>${ev ? `<span class="srclink" data-file="${esc(ev)}">src</span>` : '—'}</td></tr>`;
  }).join('');
  const edgeList = group('topo-edges', 'Edge list — every edge (incl. file-target edges not drawn in the graph)', `<table class="grid"><tr><th>from</th><th>type</th><th>to</th><th>target</th><th>provenance</th><th>source</th></tr>${edgeRows}</table>`, t.edges.length);

  const invRows = t.repoInventory.map(r => `<tr><td><span class="srclink" data-file="${esc(r.path.value)}">${esc(r.path.value)}</span></td><td>${esc(r.kind.value)}</td><td>${esc(String(r.hasDefinitionFrontmatter.value))}</td></tr>`).join('');
  const repoInv = group('topo-inv', 'Repo inventory — definition files', `<table class="grid"><tr><th>path</th><th>kind</th><th>has Phase 0b frontmatter</th></tr>${invRows}</table>`, t.repoInventory.length);

  return `<div class="banner">Topology Map — interactive node/edge graph <b>plus</b> the full structured node, edge, and repo-inventory lists below. The graph is an additional visualization layer, not a replacement; the lists carry every node and every edge (including file-target edges the graph cannot draw). Click an agent (●) or skill (▭) — or any list row's source — to inspect detail. Edge colour = provenance (Gate C Amendment 1: edges from Phase 0b frontmatter are Canonical).</div>
    ${legend}
    <div class="graph-wrap"><div class="graph-canvas"><svg viewBox="0 0 ${VBW} ${VBH}" preserveAspectRatio="xMidYMid meet">${edgeSvg}${nodeSvg}</svg></div>
    <div class="graph-detail" id="graphDetail">${detail}</div></div>
    ${accuracy}${nodeList}${edgeList}${repoInv}`;
}
function nodeById(id) { return state.topology.nodes.find(n => n.id.value === id); }
function edgesFrom(id) { return state.topology.edges.filter(e => e.from && !e.from.nys && e.from.value === id); }
function edgesTo(id) { return state.topology.edges.filter(e => e.to && !e.to.nys && e.to.value === id); }
function edgeLi(e, dir) {
  const other = dir === 'out' ? (e.to.nys ? 'not-yet-structured' : e.to.value) : e.from.value;
  const tier = e.tier && !e.tier.nys ? e.tier.value : 'nys';
  const evFile = e.source_evidence && !e.source_evidence.nys ? e.source_evidence.value.file : null;
  return `<li><b>${esc(e.type.nys ? '—' : e.type.value)}</b> ${dir === 'out' ? '→' : '←'} ${esc(other)} <span class="prov prov-${tier === 'nys' ? 'Candidate' : tier}">${tier}</span>${evFile ? ` <span class="srclink" data-file="${esc(evFile)}">src</span>` : ''}</li>`;
}
function renderGraphDetail(id) {
  if (!id) return `<h3>Inspect</h3><p style="color:var(--type-muted);font-size:12px">Click a node to see its overview, relationships, and files. Click any <span class="srclink">src</span> or file link to open it in the side viewer.</p>`;
  const n = nodeById(id); if (!n) return '<p>node not found</p>';
  const out = edgesFrom(id), inc = edgesTo(id);
  const isAgent = n.nodeType === 'agent';
  const owns = out.filter(e => !e.type.nys && e.type.value === 'owns');
  const produces = out.filter(e => !e.type.nys && e.type.value === 'produces');
  const reads = out.filter(e => !e.type.nys && e.type.value === 'reads');
  const deps = out.filter(e => !e.type.nys && e.type.value === 'depends-on');
  const rel = out.filter(e => ['reports-to', 'dispatches-to', 'consumes-from'].includes(e.type.nys ? '' : e.type.value));
  let h = `<h3>${esc(n.id.value)} <span class="pill pill-${isAgent ? 'blue' : 'green'}">${n.nodeType}</span></h3>`;
  h += `<div class="card-sub">${esc(n.name.nys ? '' : n.name.value)}${isAgent ? ' · layer ' + esc(n.layer.nys ? 'n/y/s' : n.layer.value) : ' · owner ' + esc(n.owning_agent.nys ? 'n/y/s' : n.owning_agent.value)} · ${esc(n.status.nys ? 'n/y/s' : n.status.value)}</div>`;
  if (n.source_evidence && !n.source_evidence.nys) h += `<div class="src">def: <span class="srclink" data-file="${esc(n.source_evidence.value.file)}">${esc(n.source_evidence.value.file)}</span></div>`;
  if (isAgent) {
    if (owns.length) h += `<div class="detail-sec">owned skills (${owns.length})</div><ul class="detail-list">${owns.map(e => edgeLi(e, 'out')).join('')}</ul>`;
    if (rel.length) h += `<div class="detail-sec">agent relationships</div><ul class="detail-list">${rel.map(e => edgeLi(e, 'out')).join('')}</ul>`;
    if (reads.length) h += `<div class="detail-sec">consumed inputs / reads (${reads.length})</div><ul class="detail-list">${reads.map(e => edgeLi(e, 'out')).join('')}</ul>`;
  } else {
    if (deps.length) h += `<div class="detail-sec">depends on (${deps.length})</div><ul class="detail-list">${deps.map(e => edgeLi(e, 'out')).join('')}</ul>`;
    if (produces.length) h += `<div class="detail-sec">produces (${produces.length})</div><ul class="detail-list">${produces.map(e => edgeLi(e, 'out')).join('')}</ul>`;
  }
  if (inc.length) h += `<div class="detail-sec">incoming edges (${inc.length})</div><ul class="detail-list">${inc.map(e => edgeLi(e, 'in')).join('')}</ul>`;
  return h;
}

// ===========================================================================
// Roadmap / Milestone / Review / Learning (Brief B surfaces, redesigned cards)
// ===========================================================================
function renderRoadmap() {
  const cards = state.roadmap.map(r => `<div class="card"><div class="card-head"><div class="card-title">${fv(r.phase_label)} ${prov(r.phase_label)}</div>${pill(r.target_timing.nys ? 'timing n/y/s' : r.target_timing.value, 'violet')}</div>${row('scope', r.scope_summary)}${srcLine(r.source_evidence)}</div>`).join('');
  return `<div class="banner">Roadmap Spine — Phase nodes from CLAUDE.md prose (roadmap terms Phase 1/1.5/2/3, distinct from build-maturity crawl/walk/run).</div>${group('roadmap', 'Roadmap phases', `<div class="cards">${cards}</div>`, state.roadmap.length)}`;
}
function renderMilestones() {
  const cards = state.milestones.map(m => `<div class="card"><div class="card-head"><div class="card-title">${fv(m.phase_label)} ${prov(m.phase_label)}</div>${pill(m.state.nys ? 'state n/y/s' : m.state.value, 'grey')}</div>${row('target timing', m.target_timing)}${row('connected initiatives', m.connected_initiatives)}${row('scope', m.scope_summary)}${freshChip(m.freshness)}${srcLine(m.source_evidence)}</div>`).join('');
  return `<div class="banner">Milestone surface — degraded by design (Gate C §5/Q4): label/scope Derived from prose, timing Candidate, state not-yet-structured (never inferred complete).</div>${group('ms', 'Milestones', `<div class="cards">${cards}</div>`, state.milestones.length)}`;
}
function renderReview() {
  const items = state.reviews.filter(o => matches([o.title && !o.title.nys ? o.title.value : '', o.source_path.value, o.producing_agent && !o.producing_agent.nys ? o.producing_agent.value : ''], o.status.nys ? null : o.status.value));
  const cards = items.map(o => `<div class="card click" data-open="${esc(o.source_path.value)}">
    <div class="card-head"><div class="card-title">${fv(o.title)}</div><div style="text-align:right">${pill(o.status.nys ? 'n/y/s' : o.status.value, 'grey')}<div style="margin-top:5px">${freshChip(o.freshness)}</div></div></div>
    ${row('family', o.schema_family)}${row('lifecycle', o.lifecycle_stage)}${row('producing agent', o.producing_agent)}${row('review need', o.review_need)}
    <div class="src">open: <span class="srclink" data-file="${esc(o.source_path.value)}">${esc(o.source_path.value)}</span></div></div>`).join('');
  return `<div class="banner">Review surface (FR14) — internal artifacts as reviewable objects; click to open in the side viewer. Read-only; no publish/rewrite/branding.</div>${group('rev', 'Reviewable artifacts', `<div class="cards">${cards}</div>`, `${items.length}/${state.counts.reviews}`)}`;
}
function renderLearning() {
  if (!state.learningSignals.length) return `<div class="banner">Learning Signal surface (FR15) — Candidate-tier only; orphan signals suppressed (no traceable source → not rendered). <b>No traceable Learning Signals currently resolve.</b> Correct contract behavior, not an error.</div>`;
  const cards = state.learningSignals.map(o => `<div class="card"><div class="card-head"><div class="card-title">Learning Signal</div>${pill('Candidate', 'amber')}</div>${row('signal', o.signal)}${row('confidence', o.confidence)}${srcLine(o.source_evidence)}</div>`).join('');
  return `<div class="banner">Learning Signal surface (FR15) — Candidate-tier, confidence never high, each traceable to a source.</div>${group('ls', 'Learning Signals', `<div class="cards">${cards}</div>`, state.learningSignals.length)}`;
}

// ===========================================================================
// Sources + Repo Health (B2, B3)
// ===========================================================================
function renderSources() {
  const rows = state.sources.map(s => `<tr><td>${esc(s.path)}</td><td>${esc(s.schemaFamily)}</td><td>${esc(s.governanceType || '—')}</td><td>${esc(s.fileStatus || '—')}</td><td>${s.freshness && !s.freshness.nys ? `${s.freshness.value.state} ${s.freshness.value.ageDays}d/${s.freshness.value.thresholdDays}d` : 'n/y/s'}</td><td>${s.rendersObjects ? 'renders objects' : 'loaded only'}</td><td>${s.parseError ? esc(s.parseError) : 'ok'}</td></tr>`).join('');
  return `<div class="banner">The five founder governance files Brief A loads; blocked_items.md is loaded for visibility only. Thresholds from ${esc(state.thresholdsSource)}. Discovery sweep: ${state.counts.discoveredGovernanceFiles} files under agents/*/outputs/.</div>
    <table class="grid"><tr><th>file</th><th>family</th><th>governance_type</th><th>status</th><th>freshness</th><th>Brief A role</th><th>parse</th></tr>${rows}</table>`;
}
function renderHealth() {
  const h = repoHealth;
  if (!h) return `<div class="banner">Repo Health — loading… (read-only git inspection)</div>`;
  if (h.fatal) return `<div class="card error-card"><div class="card-title">repo health error</div><p>${esc(h.fatal)}</p></div>`;
  const safe = h.safeToProceed === true ? pill('safe to proceed', 'green') : h.safeToProceed === false ? pill('caution', 'amber') : pill('unknown', 'grey');
  const up = h.upstream && h.upstream.exists ? `${esc(h.upstream.name || 'upstream')}: ${h.upstream.ahead} ahead / ${h.upstream.behind} behind` : 'no upstream configured';
  const lc = h.lastCommit ? `${esc(h.lastCommit.hash)} ${esc(h.lastCommit.subject)} — ${esc(h.lastCommit.author)} (${esc(h.lastCommit.dateLabel || h.lastCommit.date)})` : 'n/y/s';
  const workspace = `<div class="card"><div class="card-head"><div class="card-title">Workspace</div>${safe}</div>
    ${row('branch', { value: h.branch || 'n/y/s', tier: 'Canonical' })}
    ${row('clean', { value: h.clean === null ? 'unknown' : String(h.clean), tier: 'Derived' })}
    ${row('staged / unstaged / untracked', { value: `${h.counts.staged} / ${h.counts.unstaged} / ${h.counts.untracked}`, tier: 'Canonical' })}
    ${row('upstream', { value: up, tier: 'Derived' })}
    ${row('last commit', { value: lc, tier: 'Canonical' })}
    ${row('assessment', { value: h.safeReason || '', tier: 'Derived' })}
    ${h.errors && h.errors.length ? row('notes', { value: h.errors.join('; '), tier: 'Derived', nys: false }) : ''}</div>`;

  // Audit workflow (B2) — repo-harness-auditor + concrete harness, last-run status.
  const a = h.audit || { everRun: false };
  const wf = a.workflow || {};
  let auditCard;
  if (!a.everRun) {
    auditCard = `<div class="card"><div class="card-head"><div class="card-title">Repo audit</div>${pill('never run', 'grey')}</div>
      <div class="fieldrow"><span class="k">workflow</span><span class="v">repo-harness-auditor skill (read-only agentic-SDLC audit) + concrete harness</span></div>
      <div class="fieldrow"><span class="k">last run</span><span class="v"><span class="nys">never run</span></span></div>
      <div class="fieldrow"><span class="k">run it</span><span class="v"><span class="srclink" data-cmd="1">node tools/command-center/audit.js</span> — or invoke the <b>repo-harness-auditor</b> skill for the deeper audit</span></div>
      <div class="src">${esc(wf.harnessPurpose || '')}</div></div>`;
  } else {
    const freshPill = a.freshness === 'current' ? pill('just updated / current', 'green') : a.freshness === 'stale' ? pill('stale — repo changed since run', 'amber') : pill(a.freshness || 'unknown', 'grey');
    const overallPill = a.overall === 'pass' ? pill('pass', 'green') : a.overall === 'fail' ? pill('fail', 'red') : pill('—', 'grey');
    auditCard = `<div class="card"><div class="card-head"><div class="card-title">Repo audit — repo-harness-auditor</div><div style="text-align:right">${overallPill}<div style="margin-top:5px">${freshPill}</div></div></div>
      <div class="fieldrow"><span class="k">last run</span><span class="v">${esc(a.lastRunLabel || '')} <span class="src" style="display:inline">(${esc(a.lastRun || '')})</span></span></div>
      <div class="fieldrow"><span class="k">git at run</span><span class="v">${a.git ? esc(`clean=${a.git.clean} · ${a.git.staged||0}/${a.git.unstaged||0}/${a.git.untracked||0}`) : 'n/y/s'}</span></div>
      <div class="fieldrow"><span class="k">re-run</span><span class="v"><span class="srclink" data-cmd="1">node tools/command-center/audit.js</span> · deeper: <b>repo-harness-auditor</b> skill</span></div></div>`;
  }

  // Validation/test status (B3) — clear model: status + last-run + source + currency.
  const cmdRows = (h.validationCommands || []).map(c => {
    const st = c.status === 'pass' ? pill('pass', 'green') : c.status === 'fail' ? pill('fail', 'red') : c.status === 'never-run' ? pill('never run', 'grey') : pill(c.status, 'grey');
    const cur = c.currency === 'current' ? '<span class="freshchip fresh">current</span>' : c.currency === 'stale' ? '<span class="freshchip stale">stale</span>' : c.currency === 'never-run' ? '<span class="freshchip amber">never run</span>' : `<span class="freshchip amber">${esc(c.currency || '')}</span>`;
    return `<tr><td>${esc(c.label)}</td><td><span class="srclink" data-cmd="1">${esc(c.command)}</span></td><td>${st}</td><td>${cur}</td><td>${esc(c.ranAtLabel || c.ranAt || '—')}</td><td>${esc(c.source || '')}</td></tr>`;
  }).join('');
  const cmdTable = group('vc', 'Validation / test status', `<div class="banner" style="margin-bottom:10px">Status model: <b>pass/fail</b> from the last audit run · <b>current</b> = repo unchanged since the run · <b>stale</b> = repo changed since the run (re-run the audit) · <b>never run</b> = no audit recorded. Source: repo-harness-auditor harness. The cockpit does not execute these (read-only); run them via the harness/skill.</div><table class="grid"><tr><th>check</th><th>command</th><th>last status</th><th>currency</th><th>last run</th><th>source</th></tr>${cmdRows}</table>`, (h.validationCommands || []).length);

  return `<div class="banner">Repo Health (read-only). Git inspected with non-destructive reads only (rev-parse/status/log/rev-list, --no-optional-locks). No commit/push/reset/checkout controls. Audit status read from the repo-harness-auditor harness sidecar.</div>
    <div class="cards">${workspace}${auditCard}</div>${cmdTable}`;
}

// ===========================================================================
// Side panel (file viewer, B6)
// ===========================================================================
async function openFile(path) {
  const sp = $('#sidepanel');
  $('#spTitle').textContent = path;
  $('#spMeta').textContent = 'loading…';
  $('#spBody').innerHTML = '';
  sp.classList.add('open'); sp.setAttribute('aria-hidden', 'false');
  try {
    const res = await fetch('/api/file?path=' + encodeURIComponent(path), { cache: 'no-store' });
    const data = await res.json();
    if (data.error) { $('#spMeta').textContent = ''; $('#spBody').innerHTML = `<div class="sp-hint">cannot open</div><pre>${esc(data.error)}</pre>`; return; }
    $('#spMeta').textContent = `${data.size} bytes · modified ${esc(data.modified)} · read-only`;
    $('#spBody').innerHTML = `<div class="sp-hint">read-only view — edit in your editor; the cockpit never writes</div><pre>${esc(data.content)}</pre>`;
  } catch (err) { $('#spMeta').textContent = ''; $('#spBody').innerHTML = `<pre>${esc(String(err))}</pre>`; }
}
function closePanel() { const sp = $('#sidepanel'); sp.classList.remove('open'); sp.setAttribute('aria-hidden', 'true'); }

// ===========================================================================
// Render + wiring
// ===========================================================================
function statusOptions() {
  if (!state) return [];
  const s = new Set();
  if (view.tab === 'board' || view.tab === 'queue') state.approvals.forEach(o => s.add(o.state.nys ? 'not yet structured' : o.state.value));
  if (view.tab === 'board') { state.strategicInitiatives.forEach(o => s.add(o.status.nys ? 'not yet structured' : o.status.value)); state.workItems.forEach(o => s.add(o.status.nys ? 'not yet structured' : o.status.value)); }
  if (view.tab === 'review') state.reviews.forEach(o => s.add(o.status.nys ? 'not yet structured' : o.status.value));
  return [...s].sort();
}
function render() {
  if (!state) return;
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === view.tab));
  const sel = $('#filterStatus'), cur = view.filterStatus;
  sel.innerHTML = '<option value="">All statuses</option>' + statusOptions().map(s => `<option value="${esc(s)}"${s === cur ? ' selected' : ''}>${esc(s)}</option>`).join('');
  $('#loadMeta').textContent = `as of ${state.asOfDate} · loaded ${new Date(state.generatedAt).toLocaleTimeString()} · read-only`;
  const views = { overview: renderOverview, board: renderBoard, queue: renderQueue, topology: renderTopology, roadmap: renderRoadmap, milestones: renderMilestones, review: renderReview, learning: renderLearning, sources: renderSources, health: renderHealth };
  $('#main').innerHTML = (views[view.tab] || renderBoard)();
  wire();
}
function wire() {
  const main = $('#main');
  main.querySelectorAll('[data-collapse]').forEach(el => el.addEventListener('click', () => { const k = el.dataset.collapse; view.collapsed[k] = !view.collapsed[k]; render(); }));
  main.querySelectorAll('.gnode').forEach(el => el.addEventListener('click', () => { view.graphSel = el.dataset.node; render(); }));
  main.querySelectorAll('[data-file]').forEach(el => el.addEventListener('click', (e) => { e.stopPropagation(); openFile(el.dataset.file); }));
  main.querySelectorAll('.card.click[data-open]').forEach(el => el.addEventListener('click', () => openFile(el.dataset.open)));
  main.querySelectorAll('[data-gotab]').forEach(el => el.addEventListener('click', (e) => { e.stopPropagation(); goTab(el.dataset.gotab); }));
}
function goTab(tab) { view.tab = tab; view.filterStatus = ''; view.graphSel = null; render(); }

async function load() {
  $('#loadMeta').textContent = 'loading…';
  state = await (await fetch('/api/state', { cache: 'no-store' })).json();
  try { repoHealth = await (await fetch('/api/repo-health', { cache: 'no-store' })).json(); } catch (err) { repoHealth = { fatal: String(err) }; }
  render();
}

$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (!b) return; view.tab = b.dataset.tab; view.filterStatus = ''; render(); });
$('#filterText').addEventListener('input', (e) => { view.filterText = e.target.value; render(); });
$('#filterStatus').addEventListener('change', (e) => { view.filterStatus = e.target.value; render(); });
$('#refreshBtn').addEventListener('click', load);
$('#logo').addEventListener('click', () => goTab('overview'));
$('#spClose').addEventListener('click', closePanel);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

load().catch(err => { $('#main').innerHTML = `<div class="card error-card"><div class="card-title">load failed</div><pre>${esc(String(err))}</pre></div>`; });
