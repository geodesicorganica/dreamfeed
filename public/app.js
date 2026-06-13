'use strict';
// Dreamfeed frontend. View state (tab, filters, collapse) is held in memory
// only — nothing is persisted (FR16: non-persistent view controls) and nothing
// is ever sent back to the server beyond GET /api/state.

let state = null;
let repoHealth = null;
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
  const views = {
    board: renderBoard, queue: renderQueue, sources: renderSources,
    topology: renderTopology, roadmap: renderRoadmap, milestones: renderMilestones,
    review: renderReview, learning: renderLearning, health: renderHealth,
  };
  main.innerHTML = (views[view.tab] || renderBoard)();
  main.querySelectorAll('[data-collapse]').forEach(el =>
    el.addEventListener('click', () => { const k = el.dataset.collapse; view.collapsed[k] = !view.collapsed[k]; render(); }));
}

// ---- Brief B + Goal C render functions ----
function tierBadge(f) { return f && f.tier ? `<span class="badge tier-${f.tier}">${f.tier[0]}</span>` : ''; }
function val(f) { return !f ? '' : f.nys ? '<span class="nys">not yet structured</span>' : typeof f.value === 'object' ? esc(JSON.stringify(f.value)) : esc(f.value); }

function renderTopology() {
  const t = state.topology;
  const legend = `<div class="banner">Topology Map — Canonical Repo Inventory + relationship graph.
    Edges: <b>${t.tally.Canonical}</b> Canonical (read from Phase 0b AGENT.md/SKILL.md frontmatter, per Gate C Amendment 1) ·
    <b>${t.tally.Derived}</b> Derived · <b>${t.tally.nys}</b> not-yet-structured. Every edge shows source evidence; zero unsourced edges as fact.</div>`;
  const nodeCards = t.nodes.map(n => `<div class="card">
      <h3>${val(n.id)} <span class="badge tier-Derived">${esc(n.nodeType)}</span>
        ${n.status && !n.status.nys ? `<span class="chip ${n.status.value === 'planned' ? 'amber' : 'fresh'}">${esc(n.status.value)}</span>` : ''}</h3>
      ${n.name ? `<div class="fieldrow"><span class="k">name</span><span class="v">${val(n.name)}</span>${tierBadge(n.name)}</div>` : ''}
      ${n.layer ? `<div class="fieldrow"><span class="k">layer</span><span class="v">${val(n.layer)}</span>${tierBadge(n.layer)}</div>` : ''}
      ${n.owning_agent ? `<div class="fieldrow"><span class="k">owning_agent</span><span class="v">${val(n.owning_agent)}</span>${tierBadge(n.owning_agent)}</div>` : ''}
      ${sourceLine(n.source_evidence)}
    </div>`).join('');
  const edgeRows = t.edges.map(e => `<tr>
      <td>${val(e.from)}</td><td>${e.type ? val(e.type) : '<span class="nys">nys</span>'}</td><td>${e.to ? val(e.to) : '<span class="nys">nys</span>'}</td>
      <td>${e.tier && !e.tier.nys ? `<span class="badge tier-${e.tier.value}">${e.tier.value}</span>` : '<span class="nys">nys</span>'}</td>
      <td class="src">${e.source_evidence && !e.source_evidence.nys ? esc(e.source_evidence.value.file) + ' — ' + esc(e.source_evidence.value.locator) : ''}</td>
    </tr>`).join('');
  return legend
    + group('topo-nodes', 'Nodes (agents + skills)', `<div class="cards">${nodeCards}</div>`, t.nodes.length)
    + group('topo-edges', 'Relationship edges', `<table class="sources"><tr><th>from</th><th>type</th><th>to</th><th>provenance</th><th>source</th></tr>${edgeRows}</table>`, t.edges.length)
    + group('topo-inv', 'Canonical Repo Inventory', `<table class="sources"><tr><th>path</th><th>kind</th><th>has Phase 0b frontmatter</th></tr>${t.repoInventory.map(r => `<tr><td>${val(r.path)}</td><td>${val(r.kind)}</td><td>${val(r.hasDefinitionFrontmatter)}</td></tr>`).join('')}</table>`, t.repoInventory.length);
}

function renderRoadmap() {
  const cards = state.roadmap.map(r => `<div class="card">
      <h3>${val(r.phase_label)} ${tierBadge(r.phase_label)}</h3>
      <div class="fieldrow"><span class="k">target timing</span><span class="v">${val(r.target_timing)}</span>${tierBadge(r.target_timing)}</div>
      <div class="fieldrow"><span class="k">scope</span><span class="v">${val(r.scope_summary)}</span>${tierBadge(r.scope_summary)}</div>
      ${sourceLine(r.source_evidence)}
    </div>`).join('');
  return `<div class="banner">Roadmap Spine — Phase nodes from CLAUDE.md Phase-sequencing prose. Roadmap terms (Phase 1/1.5/2/3) are distinct from build-maturity terms (crawl/walk/run).</div>`
    + group('roadmap', 'Roadmap phases', `<div class="cards">${cards}</div>`, state.roadmap.length);
}

function renderMilestones() {
  const cards = state.milestones.map(m => `<div class="card">
      <h3>${val(m.phase_label)} ${tierBadge(m.phase_label)}</h3>
      <div class="fieldrow"><span class="k">state</span><span class="v">${val(m.state)}</span>${tierBadge(m.state)}</div>
      <div class="fieldrow"><span class="k">target timing</span><span class="v">${val(m.target_timing)}</span>${tierBadge(m.target_timing)}</div>
      <div class="fieldrow"><span class="k">connected initiatives</span><span class="v">${val(m.connected_initiatives)}</span>${tierBadge(m.connected_initiatives)}</div>
      ${freshnessChip(m.freshness)}
      <div class="fieldrow"><span class="k">scope</span><span class="v">${val(m.scope_summary)}</span>${tierBadge(m.scope_summary)}</div>
      ${sourceLine(m.source_evidence)}
    </div>`).join('');
  return `<div class="banner">Milestone surface — degraded by design (Gate C §5/Q4): phase_label/scope Derived from prose, timing Candidate, state not-yet-structured (no canonical completion field; never inferred complete). No canonical roadmap file is created.</div>`
    + group('milestones', 'Milestones', `<div class="cards">${cards}</div>`, state.milestones.length);
}

function renderReview() {
  const items = state.reviews.filter(o => matchesFilters(o,
    [o.title && !o.title.nys ? o.title.value : '', o.source_path.value, o.producing_agent && !o.producing_agent.nys ? o.producing_agent.value : ''], o.status));
  const cards = items.map(o => `<div class="card">
      <h3>${val(o.title)}</h3>
      ${stateChip(o.status)}${freshnessChip(o.freshness)}<span class="chip state-open">${val(o.schema_family)}</span>
      <div class="fieldrow"><span class="k">lifecycle</span><span class="v">${val(o.lifecycle_stage)}</span>${tierBadge(o.lifecycle_stage)}</div>
      <div class="fieldrow"><span class="k">producing_agent</span><span class="v">${val(o.producing_agent)}</span>${tierBadge(o.producing_agent)}</div>
      <div class="fieldrow"><span class="k">review need</span><span class="v">${val(o.review_need)}</span>${tierBadge(o.review_need)}</div>
      <div class="fieldrow"><span class="k">related initiative</span><span class="v">${val(o.related_initiative)}</span>${tierBadge(o.related_initiative)}</div>
      ${sourceLine(o.source_evidence)}
    </div>`).join('');
  return `<div class="banner">Review surface (FR14) — internal artifacts surfaced as reviewable objects. Read-only: no publish, rewrite, external exposure, or branding.</div>`
    + group('review', 'Reviewable artifacts', `<div class="cards">${cards}</div>`, `${items.length}/${state.counts.reviews}`);
}

function renderLearning() {
  if (!state.learningSignals.length) {
    return `<div class="banner">Learning Signal surface (FR15) — Candidate-tier only; orphan signals are suppressed (no traceable source → not rendered). <b>No traceable Learning Signals currently resolve</b>, so none are shown. This is the correct contract behavior, not an error.</div>`;
  }
  const cards = state.learningSignals.map(o => `<div class="card">
      <h3>Learning Signal <span class="badge tier-Candidate">Candidate</span></h3>
      <div class="fieldrow"><span class="k">signal</span><span class="v">${val(o.signal)}</span>${tierBadge(o.signal)}</div>
      <div class="fieldrow"><span class="k">confidence</span><span class="v">${val(o.confidence)}</span>${tierBadge(o.confidence)}</div>
      <div class="fieldrow"><span class="k">source artifact</span><span class="v">${val(o.source_artifact)}</span>${tierBadge(o.source_artifact)}</div>
      ${sourceLine(o.source_evidence)}
    </div>`).join('');
  return `<div class="banner">Learning Signal surface (FR15) — Candidate-tier, confidence never high, each backed by a traceable source artifact.</div>`
    + group('learning', 'Learning Signals', `<div class="cards">${cards}</div>`, state.learningSignals.length);
}

function renderHealth() {
  const h = repoHealth;
  if (!h) return `<div class="banner">Repo Health — loading… (read-only git inspection)</div>`;
  if (h.fatal) return `<div class="card error-card"><h3>repo health error</h3><p>${esc(h.fatal)}</p></div>`;
  const safeChip = h.safeToProceed === true ? `<span class="chip fresh">safe to proceed</span>`
    : h.safeToProceed === false ? `<span class="chip amber">caution</span>` : `<span class="chip nys">unknown</span>`;
  const up = h.upstream && h.upstream.exists
    ? `${esc(h.upstream.name || 'upstream')}: ${h.upstream.ahead} ahead, ${h.upstream.behind} behind`
    : 'no upstream configured';
  const lc = h.lastCommit ? `${esc(h.lastCommit.hash)} ${esc(h.lastCommit.subject)} (${esc(h.lastCommit.author)})` : 'not yet structured';
  const cmds = h.validationCommands.map(c => `<tr><td class="src">${esc(c.command)}</td><td>${esc(c.cwd)}</td><td>${esc(c.purpose)}</td><td>${esc(c.lastObserved)}</td></tr>`).join('');
  const banner = `<div class="banner">Repo Health (read-only). Git is inspected with non-destructive reads only (rev-parse, status, log, rev-list, --no-optional-locks). No commit / push / reset / checkout controls exist here.</div>`;
  return banner + `<div class="cards"><div class="card">
      <h3>workspace ${safeChip}</h3>
      <div class="fieldrow"><span class="k">branch</span><span class="v">${esc(h.branch || 'nys')}</span></div>
      <div class="fieldrow"><span class="k">clean</span><span class="v">${h.clean === null ? 'unknown' : h.clean}</span></div>
      <div class="fieldrow"><span class="k">staged / unstaged / untracked</span><span class="v">${h.counts.staged} / ${h.counts.unstaged} / ${h.counts.untracked}</span></div>
      <div class="fieldrow"><span class="k">upstream</span><span class="v">${up}</span></div>
      <div class="fieldrow"><span class="k">last commit</span><span class="v">${lc}</span></div>
      <div class="fieldrow"><span class="k">assessment</span><span class="v">${esc(h.safeReason || '')}</span></div>
      ${h.errors && h.errors.length ? `<div class="fieldrow"><span class="k">notes</span><span class="nys">${esc(h.errors.join('; '))}</span></div>` : ''}
    </div></div>`
    + group('health-cmds', 'Validation / test commands (run manually — read-only cockpit does not execute)', `<table class="sources"><tr><th>command</th><th>cwd</th><th>purpose</th><th>last observed</th></tr>${cmds}</table>`, h.validationCommands.length);
}

async function load() {
  $('#loadMeta').textContent = 'loading…';
  const res = await fetch('/api/state', { cache: 'no-store' });
  state = await res.json();
  try { repoHealth = await (await fetch('/api/repo-health', { cache: 'no-store' })).json(); }
  catch (err) { repoHealth = { fatal: String(err) }; }
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
