'use strict';
// Dreamfeed frontend. View state (tab, filters, collapse) is held in memory
// only — nothing is persisted (FR16: non-persistent view controls) and nothing
// is ever sent back to the server beyond GET /api/state.

let state = null;
const view = { tab: 'board', filterText: '', filterStatus: '', collapsed: {} };

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fieldHtml(label, f) {
  if (f === undefined) return '';
  const tier = `<span class="badge tier-${f.tier}">${f.tier[0]}</span>`;
  const val = f.nys
    ? `<span class="nys">not yet structured</span>`
    : typeof f.value === 'object'
      ? `<span class="v">${esc(JSON.stringify(f.value))}</span>`
      : `<span class="v">${esc(f.value)}</span>`;
  return `<div class="fieldrow"><span class="k">${esc(label)}</span>${val}${tier}</div>`;
}

function freshnessChip(f) {
  if (!f || f.nys) return `<span class="chip nys">freshness: not yet structured</span>`;
  const v = f.value;
  return `<span class="chip ${v.state}">${v.state} · ${v.ageDays}d / ${v.thresholdDays}d</span>`;
}

function stateChip(f) {
  if (!f) return '';
  if (f.nys) return `<span class="chip nys">state: not yet structured</span>`;
  return `<span class="chip state-${esc(f.value)}">${esc(f.value)}</span>`;
}

function sourceLine(f) {
  if (!f || f.nys) return '';
  return `<div class="src">source: ${esc(f.value.file)} — ${esc(f.value.locator)}</div>`;
}

function matchesFilters(obj, texts, statusField) {
  if (view.filterText) {
    const hay = texts.join(' ').toLowerCase();
    if (!hay.includes(view.filterText.toLowerCase())) return false;
  }
  if (view.filterStatus) {
    const s = statusField && !statusField.nys ? String(statusField.value) : 'not yet structured';
    if (s !== view.filterStatus) return false;
  }
  return true;
}

function group(key, title, innerHtml, count) {
  const collapsed = !!view.collapsed[key];
  return `<section class="group">
    <div class="group-head" data-collapse="${key}">
      <span class="chev">${collapsed ? '▶' : '▼'}</span><h2>${esc(title)}</h2>
      <span class="count">${count}</span>
    </div>
    <div class="${collapsed ? 'hidden' : ''}">${innerHtml}</div>
  </section>`;
}

function renderBoard() {
  const si = state.strategicInitiatives.filter(o => matchesFilters(o,
    [o.name.value, o.owner.value, o.status_note ? o.status_note.value : ''], o.status));
  const wi = state.workItems.filter(o => matchesFilters(o,
    [o.rank.value, o.action.value, o.initiative.value, o.status_note ? o.status_note.value : ''], o.status));
  const ap = state.approvals.filter(o => matchesFilters(o,
    [o.id && !o.id.nys ? o.id.value : '', o.decision ? o.decision.value : '', o.title && !o.title.nys ? o.title.value : '',
     o.initiative && !o.initiative.nys ? o.initiative.value : ''], o.state));

  const siCards = si.map(o => `<div class="card">
      <h3>${o.name.nys ? '<span class="nys">not yet structured</span>' : esc(o.name.value)}
        ${o.manual_flag && o.manual_flag.value === true ? '<span class="badge tier-Candidate">manual</span>' : ''}</h3>
      ${stateChip(o.status)}${freshnessChip(o.freshness)}
      ${fieldHtml('stage', o.stage)}${fieldHtml('status', o.status)}${fieldHtml('status_note', o.status_note)}
      ${fieldHtml('owner', o.owner)}${fieldHtml('success_definition', o.success_definition)}
      ${sourceLine(o.source_evidence)}
    </div>`).join('');

  const wiCards = wi.map(o => `<div class="card">
      <h3>${esc(o.rank.value)} · ${esc(o.action.value).slice(0, 120)}${o.action.value.length > 120 ? '…' : ''}</h3>
      ${stateChip(o.status)}${freshnessChip(o.freshness)}
      ${fieldHtml('action', o.action)}${fieldHtml('owner', o.owner)}${fieldHtml('initiative', o.initiative)}
      ${fieldHtml('initiative_link', o.initiative_link)}${fieldHtml('estimate', o.estimate)}
      ${fieldHtml('status', o.status)}${fieldHtml('status_note', o.status_note)}${fieldHtml('sprint_week', o.sprint_week)}
      ${sourceLine(o.source_evidence)}
    </div>`).join('');

  const apCards = ap.map(approvalCard).join('');

  const errHtml = state.parseErrors.length
    ? `<div class="cards">${state.parseErrors.map(e => `<div class="card error-card">
        <h3>parse error</h3>
        <div class="fieldrow"><span class="k">file</span><span class="v">${esc(e.path)}</span></div>
        <div class="fieldrow"><span class="k">error</span><span class="v">${esc(e.error)}</span></div>
      </div>`).join('')}</div>`
    : `<p style="color:var(--type-muted);font-size:12px">No parse errors.</p>`;

  return [
    group('si', 'Strategic Initiatives', `<div class="cards">${siCards}</div>`, `${si.length}/${state.counts.strategicInitiatives}`),
    group('wi', 'Work Items — week of ' + esc(stateSprintWeek()), `<div class="cards">${wiCards}</div>`, `${wi.length}/${state.counts.workItems}`),
    group('ap', 'Approvals (all states)', `<div class="cards">${apCards}</div>`, `${ap.length}/${state.counts.approvalsTotal}`),
    group('err', 'Parse errors', errHtml, state.counts.parseErrors),
  ].join('');
}

function stateSprintWeek() {
  const w = state.workItems[0];
  return w && w.sprint_week && !w.sprint_week.nys ? w.sprint_week.value : 'not yet structured';
}

function approvalCard(o) {
  const heading = o.source_kind.value === 'decision'
    ? `${o.id.nys ? '?' : esc(o.id.value)} · decision`
    : `${o.id.nys ? '<span class="nys">not yet structured</span>' : esc(o.id.value)} · dispatch gate`;
  return `<div class="card">
      <h3>${heading}</h3>
      ${stateChip(o.state)}${freshnessChip(o.freshness)}
      ${fieldHtml('decision', o.decision)}${fieldHtml('title', o.title)}${fieldHtml('gate_condition', o.gate_condition)}
      ${fieldHtml('consequence_if_deferred', o.consequence_if_deferred)}
      ${fieldHtml('decision_maker', o.decision_maker)}${fieldHtml('information_needed', o.information_needed)}
      ${fieldHtml('target_agent', o.target_agent)}${fieldHtml('initiative', o.initiative)}
      ${fieldHtml('resolution_date', o.resolution_date)}${fieldHtml('source_kind', o.source_kind)}
      ${sourceLine(o.source_evidence)}
    </div>`;
}

function renderQueue() {
  const q = state.approvalQueue.filter(o => matchesFilters(o,
    [o.id && !o.id.nys ? o.id.value : '', o.decision ? o.decision.value : '', o.title && !o.title.nys ? o.title.value : '',
     o.initiative && !o.initiative.nys ? o.initiative.value : ''], o.state));
  const banner = `<div class="banner">Approval Queue — every open decision-queue row and every
    conditional/pending dispatch gate (FR10). ${state.counts.openDecisions} open decisions ·
    ${state.counts.conditionalGates} conditional gates · ${state.counts.pendingGates} pending gates.
    Review and decide in the source files; Dreamfeed is read-only.</div>`;
  return banner + group('queue', 'Founder Approval Queue', `<div class="cards">${q.map(approvalCard).join('')}</div>`, `${q.length}/${state.counts.approvalQueue}`);
}

function renderSources() {
  const rows = state.sources.map(s => {
    const f = s.freshness;
    const chip = !f || f.nys ? '<span class="chip nys">not yet structured</span>'
      : `<span class="chip ${f.value.state}">${f.value.state} · ${f.value.ageDays}d / ${f.value.thresholdDays}d</span>`;
    return `<tr>
      <td>${esc(s.path)}</td><td>${esc(s.schemaFamily)}</td><td>${esc(s.governanceType || '—')}</td>
      <td>${esc(s.fileStatus || '—')}</td><td>${chip}</td>
      <td>${s.rendersObjects ? 'renders objects' : 'loaded only (no Brief A object)'}</td>
      <td>${s.parseError ? `<span class="nys">${esc(s.parseError)}</span>` : 'ok'}</td>
    </tr>`;
  }).join('');
  const banner = `<div class="banner">The five founder governance files Brief A loads.
    blocked_items.md is loaded for provenance/freshness/source visibility only — it renders no
    object until Brief B. Staleness thresholds are read at runtime from
    ${esc(state.thresholdsSource)}. Discovery sweep found ${state.counts.discoveredGovernanceFiles}
    governance files under agents/*/outputs/.</div>`;
  return banner + `<table class="sources">
    <tr><th>file</th><th>schema family</th><th>governance_type</th><th>file status</th><th>freshness</th><th>Brief A role</th><th>parse</th></tr>
    ${rows}</table>`;
}

function statusOptionsForTab() {
  if (!state) return [];
  if (view.tab === 'board') {
    const s = new Set();
    state.strategicInitiatives.forEach(o => s.add(o.status.nys ? 'not yet structured' : o.status.value));
    state.workItems.forEach(o => s.add(o.status.nys ? 'not yet structured' : o.status.value));
    state.approvals.forEach(o => s.add(o.state.nys ? 'not yet structured' : o.state.value));
    return [...s].sort();
  }
  if (view.tab === 'queue') {
    return [...new Set(state.approvalQueue.map(o => o.state.nys ? 'not yet structured' : o.state.value))].sort();
  }
  return [];
}

function render() {
  if (!state) return;
  document.querySelectorAll('nav button').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === view.tab));
  const sel = $('#filterStatus');
  const current = view.filterStatus;
  sel.innerHTML = '<option value="">All statuses</option>' +
    statusOptionsForTab().map(s => `<option value="${esc(s)}" ${s === current ? 'selected' : ''}>${esc(s)}</option>`).join('');
  $('#loadMeta').textContent = `as of ${state.asOfDate} · loaded ${new Date(state.generatedAt).toLocaleTimeString()} · read-only`;
  const main = $('#main');
  main.innerHTML = view.tab === 'board' ? renderBoard() : view.tab === 'queue' ? renderQueue() : renderSources();
  main.querySelectorAll('[data-collapse]').forEach(el =>
    el.addEventListener('click', () => { const k = el.dataset.collapse; view.collapsed[k] = !view.collapsed[k]; render(); }));
}

async function load() {
  $('#loadMeta').textContent = 'loading…';
  const res = await fetch('/api/state', { cache: 'no-store' });
  state = await res.json();
  render();
}

$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  view.tab = b.dataset.tab;
  view.filterStatus = '';
  render();
});
$('#filterText').addEventListener('input', (e) => { view.filterText = e.target.value; render(); });
$('#filterStatus').addEventListener('change', (e) => { view.filterStatus = e.target.value; render(); });
$('#refreshBtn').addEventListener('click', load);

load().catch(err => { $('#main').innerHTML = `<div class="card error-card"><h3>load failed</h3><p>${esc(String(err))}</p></div>`; });
