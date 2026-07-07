'use strict';
// Dreamfeed cockpit frontend. Server state remains source-backed; shell state
// is deliberately in-memory only. No browser storage or write API is used.

let state = null;
let repoHealth = null;
let project = null;
let discovery = null; // D32 adoption bridge: /api/discovery result (read-only)
// In-memory action token (D28 local guard). Read from the /api/project
// descriptor and sent as the X-Dreamfeed-Token header on state-changing calls.
// Held in memory only — never written to any browser-side persistent store.
let actionToken = null;
let browse = null; // in-app folder browser state: { path, parent, atRoot, entries, drives }
let objectRegistry = new Map();
let evidenceRequestId = 0;
// Gate G (D31) surfaces: native work state, daily queue, sprint metrics,
// lifecycle records, and the audit ledger — all server-computed projections.
let workData = null;
let queueData = null;
let sprintData = null;
let lifecycleData = null;
let ledgerData = null;
let pendingPlan = null; // plan awaiting the approval dialog
// Assistant dock state (in-memory transcripts only; never persisted).
const assistant = { mode: 'chief-of-staff', busy: false, transcripts: { 'chief-of-staff': [], 'translator': [], 'chat': [] } };
const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';
const view = {
  tab: 'daily', filterText: '', filterStatus: '', collapsed: {}, graphSel: null,
  // D32: strategy override is session view-state only (never persisted, never
  // written to any repo); loopSel is the selected flow loop, if any;
  // showDiscovered toggles the candidate tier on hybrid maps.
  graphStrategy: 'auto', loopSel: null, showDiscovered: true,
  selectedObjectId: null, inspectorTab: 'overview', evidence: null, evidenceMode: 'rendered',
  rightMode: 'inspector', // 'inspector' | 'assistant' — the region-4 mode toggle
  workScope: null,        // { streamType, containerId, group? } from the navigator
  navCollapsed: {},
  // Wide layouts keep all five regions visible. Narrow layouts start with the
  // inspector collapsed and expose it through the command-bar drawer control.
  inspectorOpen: hasDom ? window.innerWidth > 940 : true, bottomOpen: true, sidebarOpen: false, density: 'comfortable', feedback: [],
};

// The explicit Dreamfeed view registry. Existing Command Center tabs are
// projections over these lenses; none are discarded by the shell rebuild.
const LENS_REGISTRY = Object.freeze({
  Queue: { tabs: ['daily', 'work'], defaultTab: 'daily' },
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

function isMarkdownPath(path) {
  return /\.md$/i.test(String(path || '').split(/[?#]/)[0]);
}
function isSafeMarkdownHref(href) {
  const value = String(href || '').trim();
  if (!value || value.startsWith('//') || /[\u0000-\u001F\u007F]/.test(value)) return false;
  try {
    const parsed = new URL(value, 'http://dreamfeed.local/');
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
function renderMarkdownInline(text) {
  const tokens = [];
  const stash = (html) => {
    const token = `\u0000DFMD${tokens.length}\u0000`;
    tokens.push([token, html]);
    return token;
  };
  let raw = String(text == null ? '' : text);
  raw = raw.replace(/`([^`\n]+)`/g, (_, code) => stash(`<code>${esc(code)}</code>`));
  raw = raw.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, label, href) => {
    if (!isSafeMarkdownHref(href)) return `${label} (${href})`;
    return stash(`<a href="${esc(href)}" rel="noopener noreferrer">${esc(label)}</a>`);
  });
  let html = esc(raw);
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*\n][^*\n]*?)\*/g, '$1<em>$2</em>');
  for (const [token, value] of tokens) html = html.replaceAll(token, value);
  return html;
}
function splitMarkdownTableRow(line) {
  return String(line || '').trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}
function isMarkdownTableStart(lines, index) {
  const header = String(lines[index] || '').trim();
  const separator = String(lines[index + 1] || '').trim();
  if (!header.includes('|') || !separator.includes('|')) return false;
  const headers = splitMarkdownTableRow(header);
  const separators = splitMarkdownTableRow(separator);
  return headers.length > 1 && headers.length === separators.length && separators.every((cell) => /^:?-{3,}:?$/.test(cell));
}
function renderMarkdownTable(lines, index) {
  const headers = splitMarkdownTableRow(lines[index]);
  const rows = [];
  let cursor = index + 2;
  while (cursor < lines.length && String(lines[cursor]).trim().includes('|')) {
    rows.push(splitMarkdownTableRow(lines[cursor]));
    cursor++;
  }
  const head = `<thead><tr>${headers.map((cell) => `<th>${renderMarkdownInline(cell)}</th>`).join('')}</tr></thead>`;
  const body = rows.length ? `<tbody>${rows.map((row) => `<tr>${headers.map((_, i) => `<td>${renderMarkdownInline(row[i] || '')}</td>`).join('')}</tr>`).join('')}</tbody>` : '';
  return { html: `<table>${head}${body}</table>`, nextIndex: cursor };
}
function renderMarkdown(markdown) {
  const lines = String(markdown == null ? '' : markdown).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let paragraph = [];
  let list = null;
  let quote = [];
  let inCode = false;
  let codeFence = '';
  let codeLines = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push(`<p>${renderMarkdownInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    out.push(`<${list.type}>${list.items.map((item) => `<li>${renderMarkdownInline(item)}</li>`).join('')}</${list.type}>`);
    list = null;
  };
  const flushQuote = () => {
    if (!quote.length) return;
    out.push(`<blockquote>${quote.map((line) => renderMarkdownInline(line)).join('<br>')}</blockquote>`);
    quote = [];
  };
  const flushBlocks = () => { flushParagraph(); flushList(); flushQuote(); };
  let i = 0;
  if (lines[0] && lines[0].trim() === '---' && lines[0] === lines[0].trimStart()) {
    let end = -1;
    for (let j = 1; j < lines.length; j++) {
      if (lines[j].trim() === '---') { end = j; break; }
    }
    if (end !== -1) {
      const fm = lines.slice(0, end + 1);
      i = end + 1;
      out.push(`<pre class="markdown-frontmatter"><code>${esc(fm.join('\n'))}</code></pre>`);
    }
  }
  for (; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const fence = trimmed.match(/^```([A-Za-z0-9_-]+)?\s*$/);
    if (fence) {
      if (inCode) {
        out.push(`<pre><code${codeFence ? ` class="language-${esc(codeFence)}"` : ''}>${esc(codeLines.join('\n'))}</code></pre>`);
        inCode = false; codeFence = ''; codeLines = [];
      } else {
        flushBlocks(); inCode = true; codeFence = fence[1] || ''; codeLines = [];
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }
    if (!trimmed) { flushBlocks(); continue; }
    if (isMarkdownTableStart(lines, i)) {
      flushBlocks();
      const rendered = renderMarkdownTable(lines, i);
      out.push(rendered.html);
      i = rendered.nextIndex - 1;
      continue;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushBlocks();
      out.push(`<h${heading[1].length}>${renderMarkdownInline(heading[2])}</h${heading[1].length}>`);
      continue;
    }
    const quoteLine = trimmed.match(/^>\s?(.*)$/);
    if (quoteLine) {
      flushParagraph(); flushList();
      quote.push(quoteLine[1]);
      continue;
    }
    const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph(); flushQuote();
      const type = ordered ? 'ol' : 'ul';
      if (!list || list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push((unordered || ordered)[1]);
      continue;
    }
    paragraph.push(trimmed);
  }
  if (inCode) out.push(`<pre><code${codeFence ? ` class="language-${esc(codeFence)}"` : ''}>${esc(codeLines.join('\n'))}</code></pre>`);
  flushBlocks();
  return out.join('\n');
}

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
function slugId(text) { return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function candidateManifestId(candidate) {
  const source = candidate && (candidate.sourcePath || candidate.id || candidate.name);
  return slugId(`${candidate && candidate.kind ? candidate.kind : 'candidate'}-${source || 'candidate'}`) || 'candidate';
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
  if (options.graphKey) { view.graphSel = options.graphKey; view.loopSel = null; }
  feedback(`Selected ${objectRegistry.get(id).type}: ${objectRegistry.get(id).title}`);
  render();
}
async function openEvidence(path, objectId) {
  const requestId = ++evidenceRequestId;
  const id = objectId || ensureFileObject(path);
  view.selectedObjectId = id;
  view.inspectorOpen = true;
  view.inspectorTab = 'evidence';
  view.evidenceMode = isMarkdownPath(path) ? 'rendered' : 'raw';
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
  const noObjects = !state.strategicInitiatives.length && !state.workItems.length && !state.approvals.length;
  const projBanner = noObjects && project && project.configured ? `<div class="banner banner-warn">No governance objects resolved here — this folder may not follow the Dreamfeed governance layout. Use the Sources lens or the read-only file viewer to inspect it.</div>` : '';
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
function registerHumanRoot(spec) {
  // The human root is a product-level runtime node (D32), never a repo object.
  // It gets a UI record like synthetic endpoints so the shared inspector works.
  const id = `topology:${DreamfeedLayout.HUMAN_ROOT_ID}`;
  record(id, 'Human operator', 'You', null, {
    state: 'product-invariant', owner: 'you', timestamp: 'runtime', provenance: 'Runtime',
    relationships: spec.anchorNodeId ? [`operates → ${spec.anchorNodeId}`] : [],
    nextAction: spec.anchorNodeId ? 'Walk the system from your anchor node' : 'Adopt a governance layout to wire a system under you',
    overview: [['Node', DreamfeedLayout.HUMAN_ROOT_ID], ['Root rule', spec.rootRule], ['Root provenance', spec.rootProvenance], ['Anchor', spec.anchorNodeId || '—'], ['Anchor rule', spec.anchorRule || '—']],
  });
}
function registerDiscoveredNode(item) {
  const id = `topology:${item.key}`;
  if (objectRegistry.has(id)) return;
  const c = item.meta || {};
  record(id, item.kind === 'unmapped' ? 'Unmapped rollup' : 'Discovered candidate', item.label,
    item.src ? { path: item.src, locator: 'found by deterministic discovery scan' } : null, {
      state: item.tier, owner: 'discovery scanner', timestamp: 'scan', provenance: item.tier === 'unmapped' ? 'Unmapped' : 'Discovered',
      relationships: ['Contained by discovered project'],
      nextAction: item.tier === 'discovered' ? 'Promote to os/topology.md through the governed lifecycle (approval required)' : 'Promote individual files to make this area part of the topology',
      overview: [['Kind', item.kind], ['Confidence', c.confidence || '—'], ['Matched by', (c.matchedBy || []).join(', ') || '—'], ['Source path', item.src || '—'], ['Provenance', item.tier]],
    });
}
function discoveredGraph() {
  // D32 hybrid tier: candidates and unmapped rollups from /api/discovery,
  // grouped under one discovered-project node via owns edges. Empty when the
  // toggle is off or discovery has nothing.
  if (!view.showDiscovered || !discovery || discovery.fatal) return { nodes: [], edges: [] };
  const items = [];
  (discovery.candidates || []).forEach((c) => items.push({ key: c.id, kind: c.kind, label: c.name, ref: null, tier: 'discovered', src: c.sourcePath, meta: c }));
  (discovery.rollups || []).forEach((r) => items.push({ key: r.id, kind: 'unmapped', label: r.name, ref: null, tier: 'unmapped', src: r.sourcePath, meta: r }));
  if (!items.length) return { nodes: [], edges: [] };
  const projectNode = { key: 'discovered:project', kind: 'project', label: project && project.name ? `${project.name} (discovered)` : 'Discovered project', ref: null, tier: 'discovered', src: null, meta: null };
  items.forEach(registerDiscoveredNode);
  registerDiscoveredNode(projectNode);
  return {
    nodes: [projectNode].concat(items),
    edges: items.map((i) => ({ from: projectNode.key, to: i.key, type: 'owns' })),
  };
}
function graphLayout() {
  // Kind normalization and synthetic-endpoint registration stay here; all
  // geometry is delegated to the D32 orchestrator (public/layout.js).
  const nodes = graphNodes();
  const declared = [];
  state.topology.edges.forEach((e) => {
    if (e.from.nys || e.to.nys || e.type.nys) return;
    declared.push({ from: e.from.value, to: e.to.value, type: e.type.value });
  });
  const disc = discoveredGraph();
  const formalEmpty = nodes.length === 0;
  const allNodes = nodes.concat(disc.nodes);
  const spec = DreamfeedLayout.orchestrate(
    { nodes: allNodes.map((n) => ({ id: n.key, kind: n.kind, name: n.label })), edges: declared.concat(disc.edges) },
    // No formal topology + discovered content: the discovered project IS the
    // anchor (adoption bridge). With formal topology the cascade decides.
    { strategy: view.graphStrategy, anchorId: formalEmpty && disc.nodes.length ? 'discovered:project' : undefined });
  registerHumanRoot(spec);
  const human = { key: DreamfeedLayout.HUMAN_ROOT_ID, kind: 'human', label: 'You', ref: null };
  const metaByKey = new Map(allNodes.map((n) => [n.key, n]));
  metaByKey.set(human.key, human);
  const positions = {};
  spec.nodes.forEach((p) => { const meta = metaByKey.get(p.id); if (meta) positions[p.id] = { x: p.x, y: p.y, n: meta }; });
  return { positions, nodes: [human].concat(allNodes), height: spec.constraints.canvasHeight, spec, discEdges: disc.edges };
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
function graphNodeSvg(meta, pos, canvasWidth) {
  const selected = view.graphSel === meta.key ? 'sel' : ''; const id = `topology:${meta.key}`;
  const planned = meta.kind.includes('planned');
  // Labels sit beside their node in every strategy (positions are no longer
  // columnar); right-half nodes label leftward so radial rings stay readable.
  const leftHalf = pos.x > (canvasWidth || 1220) * 0.55;
  const labelX = leftHalf ? pos.x - 20 : pos.x + 20; const anchor = leftHalf ? 'end' : 'start';
  const label = esc(meta.label.length > 31 ? `${meta.label.slice(0, 30)}…` : meta.label);
  const g = (inner, extra) => `<g class="gnode${extra ? ` ${extra}` : ''} ${selected}" data-graph-node="${esc(meta.key)}" data-object-id="${esc(id)}">${inner}</g>`;
  if (meta.kind === 'human') {
    return g(`<circle cx="${pos.x}" cy="${pos.y}" r="19" fill="none" stroke="#e6c079" stroke-width="1.25" stroke-dasharray="2 3"></circle><circle cx="${pos.x}" cy="${pos.y}" r="12" fill="#3a3222" stroke="#e6c079" stroke-width="2"></circle><text x="${labelX + (leftHalf ? -6 : 6)}" y="${pos.y + 4}" text-anchor="${anchor}">${label}</text>`, 'human');
  }
  if (meta.tier === 'discovered' || meta.tier === 'unmapped') {
    // D32 provenance tiers: discovered = dashed blue, unmapped = dashed grey.
    const tint = meta.tier === 'unmapped' ? '#8a8f8a' : '#8fb4d8';
    const text = `<text x="${labelX}" y="${pos.y + 4}" text-anchor="${anchor}" class="art-label">${label}</text>`;
    if (meta.kind === 'project') return g(`<rect x="${pos.x - 16}" y="${pos.y - 13}" width="32" height="26" rx="6" fill="#243038" stroke="${tint}" stroke-width="2" stroke-dasharray="5 3"></rect>${text}`, 'discovered');
    if (meta.kind === 'agent') return g(`<circle cx="${pos.x}" cy="${pos.y}" r="12" fill="#243038" stroke="${tint}" stroke-width="1.75" stroke-dasharray="3 3"></circle>${text}`, 'discovered');
    if (meta.kind === 'skill' || meta.kind === 'workflow') return g(`<rect x="${pos.x - 11}" y="${pos.y - 10}" width="22" height="20" fill="#243038" stroke="${tint}" stroke-width="1.75" stroke-dasharray="3 3"></rect>${text}`, 'discovered');
    return g(`<rect x="${pos.x - 7}" y="${pos.y - 7}" width="14" height="14" transform="rotate(45 ${pos.x} ${pos.y})" fill="#243038" stroke="${tint}" stroke-width="1.5" stroke-dasharray="3 3"></rect>${text}`, 'discovered');
  }
  if (meta.kind === 'agent' || meta.kind === 'planned-agent') {
    return g(`<circle cx="${pos.x}" cy="${pos.y}" r="14" fill="${planned ? '#2f2740' : '#28393a'}" stroke="${planned ? '#c2a9e8' : '#7ecfd1'}" stroke-width="2"${planned ? ' stroke-dasharray="4 3"' : ''}></circle><text x="${labelX}" y="${pos.y + 4}" text-anchor="${anchor}">${label}</text>`);
  }
  if (meta.kind === 'skill' || meta.kind === 'planned-skill') {
    return g(`<rect x="${pos.x - 13}" y="${pos.y - 12}" width="26" height="24" fill="${planned ? '#2f2740' : '#2c3a31'}" stroke="${planned ? '#c2a9e8' : '#6fbf8a'}" stroke-width="2"${planned ? ' stroke-dasharray="4 3"' : ''}></rect><text x="${labelX}" y="${pos.y + 4}" text-anchor="${anchor}">${label}</text>`);
  }
  return g(`<rect x="${pos.x - 7}" y="${pos.y - 7}" width="14" height="14" transform="rotate(45 ${pos.x} ${pos.y})" fill="#272c2e" stroke="#aeb4af" stroke-width="1.5"></rect><text x="${labelX}" y="${pos.y + 4}" text-anchor="${anchor}" class="art-label">${label}</text>`);
}
function renderTopology() {
  const { positions, nodes, height, spec, discEdges } = graphLayout(); const edges = graphEdges(positions); const planned = nodes.filter((n) => n.kind.includes('planned')); const artifacts = nodes.filter((n) => n.kind === 'artifact');
  const discovered = nodes.filter((n) => n.tier === 'discovered' && n.kind !== 'project');
  const unmapped = nodes.filter((n) => n.tier === 'unmapped');
  const loop = view.loopSel ? spec.loops.find((l) => l.id === view.loopSel) : null;
  const loopPairs = new Set();
  if (loop) for (let i = 0; i < loop.nodes.length - 1; i++) { loopPairs.add(`${loop.nodes[i]}|${loop.nodes[i + 1]}`); loopPairs.add(`${loop.nodes[i + 1]}|${loop.nodes[i]}`); }
  const edgeSvg = edges.map((e) => { const a = positions[e.from]; const b = positions[e.to]; const hot = (loop && loopPairs.has(`${e.from}|${e.to}`)) || (view.graphSel && (view.graphSel === e.from || view.graphSel === e.to)); const dim = (view.graphSel || loop) && !hot; const offset = (e.duplicateIndex - (e.duplicateTotal - 1) / 2) * 9; return `<path class="gedge ${edgeClass(e.tier)}${hot ? ' hot' : ''}${dim ? ' dim' : ''}" d="M ${a.x} ${a.y} C ${(a.x + b.x) / 2} ${a.y + offset}, ${(a.x + b.x) / 2} ${b.y + offset}, ${b.x} ${b.y}"></path>`; }).join('');
  // The runtime human->anchor edge is product-level, not a source relationship:
  // drawn separately, styled distinctly, excluded from the edges-drawn tally.
  const humanPos = positions[DreamfeedLayout.HUMAN_ROOT_ID]; const anchorPos = spec.anchorNodeId ? positions[spec.anchorNodeId] : null;
  const runtimeEdge = humanPos && anchorPos ? `<path class="gedge edge-runtime${(view.graphSel || loop) ? ' dim' : ''}" d="M ${humanPos.x} ${humanPos.y} C ${(humanPos.x + anchorPos.x) / 2} ${humanPos.y}, ${(humanPos.x + anchorPos.x) / 2} ${anchorPos.y}, ${anchorPos.x} ${anchorPos.y}"></path>` : '';
  const strategies = [['auto', 'Auto'], ['layered', 'Layered'], ['radial', 'Radial'], ['clustered-loops', 'Clustered']];
  const discCount = discovery && discovery.candidates ? discovery.candidates.length : 0;
  const toolbar = `<div class="graph-toolbar"><span class="graph-why">Layout: <strong>${esc(spec.strategy)}</strong>${spec.strategyRequested ? ' (manual)' : ''} · ${esc(spec.why)} · root: You · anchor: ${spec.anchorNodeId ? `${esc(String(spec.anchorNodeId))} via ${esc(String(spec.anchorRule))}` : '—'}</span><span class="strategy-switch" role="group" aria-label="Layout strategy override (session only)">${strategies.map(([v, l]) => `<button class="strategy-btn${(view.graphStrategy || 'auto') === v ? ' active' : ''}" data-strategy="${v}">${l}</button>`).join('')}</span><span class="strategy-switch"><button class="strategy-btn${view.showDiscovered ? ' active' : ''}" data-toggle-discovered aria-pressed="${String(view.showDiscovered)}">Candidates: ${view.showDiscovered ? 'shown' : 'hidden'}${discCount ? ` (${discCount})` : ''}</button><button class="strategy-btn" data-rescan>Rescan</button></span>${spec.warnings.length ? `<span class="graph-warn">${esc(spec.warnings.join(' '))}</span>` : ''}</div>`;
  const discEdgeSvg = (discEdges || []).map((e) => { const a = positions[e.from]; const b = positions[e.to]; if (!a || !b) return ''; return `<path class="gedge edge-discovered${(view.graphSel || loop) ? ' dim' : ''}" d="M ${a.x} ${a.y} C ${(a.x + b.x) / 2} ${a.y}, ${(a.x + b.x) / 2} ${b.y}, ${b.x} ${b.y}"></path>`; }).join('');
  const legend = `<div class="graph-legend"><span>◉ you</span><span>● agent</span><span>▭ skill</span><span>⬚ planned / no definition file</span><span>◇ artifact</span><span>◌ discovered candidate</span><span>▩ unmapped rollup</span><span><i class="lg-line edge-canon"></i> Canonical relationship</span><span>${nodes.length} endpoints · ${edges.length}/${state.topology.edges.length} edges drawn</span></div>`;
  const shortId = (id) => { const s = isFileRef(id) ? baseName(id) : String(id); return s.length > 18 ? `${s.slice(0, 17)}…` : s; };
  const loopList = spec.loops.length
    ? spec.loops.map((l) => `<button class="loop-item${view.loopSel === l.id ? ' sel' : ''}" data-loop="${esc(l.id)}"><span class="loop-tag">${esc(l.weight)}</span>${esc(l.nodes.map(shortId).join(' → '))}</button>`).join('')
    : '<p class="odim">No flow loops detected. Loops appear when produced artifacts feed back upstream.</p>';
  const graph = `<div class="graph-wrap"><div class="graph-canvas"><svg width="${spec.constraints.canvasWidth}" height="${height}" viewBox="0 0 ${spec.constraints.canvasWidth} ${height}" role="img" aria-label="Human-rooted source-backed topology graph">${discEdgeSvg}${runtimeEdge}${edgeSvg}${Object.values(positions).map((p) => graphNodeSvg(p.n, p, spec.constraints.canvasWidth)).join('')}</svg></div><div class="graph-detail"><h3>${view.graphSel ? esc(objectRegistry.get(`topology:${view.graphSel}`)?.title || baseName(view.graphSel)) : 'Graph selection'}</h3><p class="odim">${view.graphSel ? 'The selected node and all source evidence are in the shared inspector.' : 'Select any node. Edges highlight, then the same inspector used by cards and tables opens.'}</p><div class="detail-sec">Loops</div>${loopList}<div class="detail-sec">Coverage</div><ul class="detail-list"><li>${nodes.length} rendered endpoints</li><li>${edges.length} rendered edges</li><li>${planned.length} declared but unbuilt</li><li>${artifacts.length} input/output artifacts</li></ul></div></div>`;
  const nodeRows = nodes.map((n) => { const id = `topology:${n.key}`; const source = n.ref ? sourceInfo(n.ref.source_evidence)?.path : n.src ? n.src : isFileRef(n.key) ? n.key : null; return `<tr data-object-id="${esc(id)}" class="${view.selectedObjectId === id ? 'selected' : ''}"><td>${esc(n.label)}</td><td>${esc(n.kind)}</td><td>${source ? sourceLink(source, 'source') : '—'}</td></tr>`; }).join('');
  const edgeRows = state.topology.edges.map((e, index) => { const id = `topology-edge:${index}`; const source = sourceInfo(e.source_evidence)?.path; if (!objectRegistry.has(id)) record(id, 'Topology relationship', `${fieldValue(e.from)} → ${fieldValue(e.to)}`, source ? { path: source, locator: 'definition frontmatter' } : null, { state: fieldValue(e.type), owner: fieldValue(e.from), timestamp: 'source-backed', provenance: fieldValue(e.tier), relationships: [fieldValue(e.to)], nextAction: 'Open edge source', overview: [['From', fieldValue(e.from)], ['To', fieldValue(e.to)], ['Type', fieldValue(e.type)]] }); return `<tr data-object-id="${esc(id)}" class="${view.selectedObjectId === id ? 'selected' : ''}"><td>${esc(fieldValue(e.from))}</td><td>${esc(fieldValue(e.type))}</td><td>${esc(fieldValue(e.to))}</td><td>${prov(e.tier)}</td><td>${source ? sourceLink(source, 'source') : '—'}</td></tr>`; }).join('');
  const plannedRows = planned.map((n) => `<tr data-object-id="topology:${esc(n.key)}"><td>${esc(n.label)}</td><td>${esc(n.kind)}</td><td>Referenced in definition frontmatter; no AGENT.md/SKILL.md found.</td></tr>`).join('');
  return `<div class="banner">Topology lens — human-rooted map (D32): you are the root, the anchor is the first source-backed node under you. Graph, node list, edge list, and repository inventory project the same Gate C source-backed topology; file endpoints and all edges remain visible rather than being silently omitted.</div>${toolbar}${legend}${graph}${discovered.length || unmapped.length ? group('topology-discovered', 'Discovered — adoption frontier (candidates await promotion)', `<table class="grid"><tr><th>name</th><th>kind</th><th>confidence</th><th>matched by</th><th>source</th><th></th></tr>${discovered.map((n) => `<tr data-object-id="topology:${esc(n.key)}" class="${view.selectedObjectId === `topology:${n.key}` ? 'selected' : ''}"><td>${esc(n.label)}</td><td>${esc(n.kind)}</td><td>${esc((n.meta && n.meta.confidence) || '—')}</td><td>${esc(((n.meta && n.meta.matchedBy) || []).join(', ') || '—')}</td><td>${n.src ? sourceLink(n.src, 'source') : '—'}</td><td><button class="strategy-btn" data-promote="${esc(n.key)}">Promote…</button></td></tr>`).join('')}${unmapped.map((n) => `<tr data-object-id="topology:${esc(n.key)}"><td>${esc(n.label)}</td><td>unmapped</td><td>—</td><td>—</td><td>—</td></tr>`).join('')}</table>`, discovered.length + unmapped.length) : ''}${planned.length ? group('topology-planned', 'Declared but unbuilt', `<table class="grid"><tr><th>id</th><th>kind</th><th>state</th></tr>${plannedRows}</table>`, planned.length) : ''}${group('topology-nodes', 'Node list — every graph node', `<table class="grid"><tr><th>id</th><th>kind</th><th>source</th></tr>${nodeRows}</table>`, nodes.length)}${group('topology-edges', 'Edge list — every source relationship', `<table class="grid"><tr><th>from</th><th>type</th><th>to</th><th>provenance</th><th>evidence</th></tr>${edgeRows}</table>`, state.topology.edges.length)}${group('topology-inventory', 'Repository inventory — definition files', `<table class="grid"><tr><th>path</th><th>kind</th><th>frontmatter</th></tr>${state.topology.repoInventory.map((r) => `<tr data-object-id="source:${esc(r.path.value)}"><td>${esc(r.path.value)}</td><td>${esc(r.kind.value)}</td><td>${esc(String(r.hasDefinitionFrontmatter.value))}</td></tr>`).join('')}</table>`, state.topology.repoInventory.length)}`;
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
  const auditCard = `<article class="card"><div class="card-head"><div class="card-title">Audit — repo-harness-auditor</div>${pill(status, color)}</div><div class="fieldrow"><span class="k">last run</span><span class="v">${esc(audit.lastRunLabel || 'never run')} ${audit.lastRun ? `(${esc(audit.lastRun)})` : ''}</span></div><div class="fieldrow"><span class="k">currency</span><span class="v">${esc(audit.freshness || 'never run')}</span></div><div class="fieldrow"><span class="k">workflow</span><span class="v">Read-only skill + harness sidecar. The cockpit never runs it.</span></div><div class="src">run externally: <span class="srclink" data-command="node audit.js">node audit.js</span></div></article>`;
  const commands = (h.validationCommands || []).map((c) => `<tr><td>${esc(c.label)}</td><td><span class="srclink" data-command="${esc(c.command)}">${esc(c.command)}</span></td><td>${pill(c.status, c.status === 'pass' ? 'green' : c.status === 'fail' ? 'red' : 'grey')}</td><td>${esc(c.currency)}</td><td>${esc(c.ranAtLabel || 'never run')}</td><td>${esc(c.source)}</td></tr>`).join('');
  return `<div class="banner">Repo Health is an inspection surface. It displays read-only Git state and existing audit records; it does not run commands, change files, or create a new source of truth.</div><div class="cards">${workspace}${auditCard}</div>${group('validation', 'Validation / test status', `<table class="grid"><tr><th>check</th><th>command</th><th>last result</th><th>currency</th><th>last run</th><th>source</th></tr>${commands}</table>`, (h.validationCommands || []).length)}`;
}

// ---------------------------------------------------------------------------
// Shared Inspector (region 4) and source-backed validation panel (region 5).
// ---------------------------------------------------------------------------
function renderEvidenceView(item) {
  if (!(view.evidence && view.evidence.path === item.sourcePath)) {
    return item.sourcePath ? `<p class="odim">Source evidence is available. Use the read-only action above to load it into this inspector.</p>` : '<p class="odim">No source file is available for this derived selection.</p>';
  }
  if (view.evidence.loading) return '<p class="odim">Loading source evidence...</p>';
  if (view.evidence.error) return `<pre class="evidence-content">${esc(view.evidence.error)}</pre>`;
  const meta = `<div class="evidence-meta">${esc(view.evidence.meta || '')} · Read-only. Edit in an editor; the cockpit never writes.</div>`;
  const raw = `<pre class="evidence-content">${esc(view.evidence.content || '')}</pre>`;
  if (!isMarkdownPath(view.evidence.path)) return meta + raw;
  const mode = view.evidenceMode === 'raw' ? 'raw' : 'rendered';
  const toggle = `<div class="evidence-mode" role="group" aria-label="Evidence display mode"><button type="button" data-evidence-mode="rendered" class="${mode === 'rendered' ? 'active' : ''}">Rendered</button><button type="button" data-evidence-mode="raw" class="${mode === 'raw' ? 'active' : ''}">Raw</button></div>`;
  return `${meta}${toggle}${mode === 'raw' ? raw : `<div class="markdown-body">${renderMarkdown(view.evidence.content || '')}</div>`}`;
}
// ---------------------------------------------------------------------------
// Gate G (D31): mutation helper, daily queue, work detail, workstream nav,
// approval dialog, and the assistant dock. Every mutation goes through the
// governed lifecycle routes; nothing here writes directly.
// ---------------------------------------------------------------------------
async function postMutation(url, body = {}) {
  const headers = { 'Content-Type': 'application/json', 'X-Dreamfeed-Token': actionToken || '' };
  let res = await fetch(url, { method: 'POST', cache: 'no-store', headers, body: JSON.stringify(body) });
  if (res.status === 403) {
    try {
      const d = await (await fetch('/api/project', { cache: 'no-store' })).json();
      if (d && d.actionToken && d.actionToken !== actionToken) {
        actionToken = d.actionToken;
        headers['X-Dreamfeed-Token'] = actionToken;
        res = await fetch(url, { method: 'POST', cache: 'no-store', headers, body: JSON.stringify(body) });
      }
    } catch { /* fall through with the original 403 */ }
  }
  return res;
}

const QUEUE_STATE_KIND = { planned: 'grey', active: 'blue', blocked: 'red', done: 'green', 'pending-approval': 'amber', executing: 'blue', succeeded: 'green', failed: 'red' };
function statePill(value) { return pill(value || 'not yet structured', QUEUE_STATE_KIND[value] || 'grey'); }

function chainLabel(chain) {
  if (!chain) return '';
  return chain.goal
    ? `${chain.goal} › ${chain.phase} › ${chain.milestone}`
    : `${chain.operation} › ${chain.workflow}`;
}

function taskActions(task) {
  const status = fieldValue(task.status, 'planned');
  const id = fieldValue(task.id, '');
  const buttons = [];
  if (status !== 'active' && status !== 'done') buttons.push(['active', 'Start']);
  if (status !== 'done') buttons.push(['done', 'Done']);
  buttons.push(status === 'blocked' ? ['planned', 'Unblock'] : ['blocked', 'Block']);
  return buttons.map(([to, label]) =>
    `<button type="button" class="command-button task-action" data-transition="${esc(id)}" data-to="${esc(to)}">${esc(label)}</button>`).join('');
}

function queueRow(entry) {
  const t = entry.task;
  return `<div class="queue-row" data-stream="${esc(entry.streamType)}">
    <span class="queue-stream" title="${esc(entry.streamType)}">${entry.streamType === 'goal' ? 'G' : 'O'}</span>
    <div class="queue-main">
      <div class="queue-title">${esc(fieldValue(t.title))} <span class="odim">${esc(fieldValue(t.id, ''))}</span></div>
      <div class="queue-chain">${esc(chainLabel(t.chain?.value))}</div>
    </div>
    <span class="queue-est">${t.est_hours && !t.est_hours.nys ? esc(t.est_hours.value + 'h') : ''}</span>
    <span class="queue-date">${esc(fieldValue(t.scheduled, ''))}</span>
    ${statePill(fieldValue(t.status))}
    <div class="queue-actions">${taskActions(t)}</div>
  </div>`;
}

function renderDaily() {
  if (!queueData || queueData.hasNative === false) {
    return `<article class="card"><div class="card-title">Daily execution queue</div>
      <p class="odim">The active project has no Dreamfeed-native <code>os/</code> layout (goals, operations). See <code>docs/product/native-schema.md</code> to adopt it, or use the classic lenses from the sidebar.</p>
      <button type="button" class="command-button" data-gotab="overview">Open classic Overview</button></article>`;
  }
  const s = queueData.sections;
  const section = (key, title, entries) => group(`dq-${key}`, title, entries.length
    ? entries.map(queueRow).join('')
    : '<p class="odim">Nothing here.</p>', entries.length);
  const pendingNote = pendingApprovals().length
    ? `<article class="card warn-card"><div class="card-title">Pending approvals</div><p>${pendingApprovals().length} plan(s) await your explicit approval — see the bottom panel.</p></article>` : '';
  return `${pendingNote}${section('today', 'Today', s.today)}${section('rolled', 'Rolled over', s.rolledOver)}${section('upcoming', 'Upcoming (7 days)', s.upcoming)}`;
}

function workTaskTable(tasks) {
  return `<table class="data-table"><thead><tr><th>ID</th><th>Task</th><th>Status</th><th>Est</th><th>Scheduled</th><th>Owner</th><th></th></tr></thead><tbody>${tasks.map((t) =>
    `<tr><td>${esc(fieldValue(t.localId))}</td><td>${esc(fieldValue(t.title))}</td><td>${statePill(fieldValue(t.status))}</td><td>${t.est_hours && !t.est_hours.nys ? esc(t.est_hours.value + 'h') : '—'}</td><td>${esc(fieldValue(t.scheduled, '—'))}</td><td>${esc(fieldValue(t.owner, '—'))}</td><td class="queue-actions">${taskActions(t)}</td></tr>`).join('')}</tbody></table>`;
}

function renderWork() {
  if (!workData || workData.hasNative === false) return renderDaily();
  const scope = view.workScope;
  const parts = [];
  const wantGoal = !scope || scope.streamType === 'goal';
  const wantOp = !scope || scope.streamType === 'operation';
  if (wantGoal) {
    for (const g of workData.goals) {
      if (scope && scope.containerId && g.id.value !== scope.containerId) continue;
      const inner = g.phases.map((p) => `<h3 class="work-phase">Phase: ${esc(p.title.value)}</h3>` +
        p.milestones.map((m) => `<h4 class="work-milestone">Milestone: ${esc(m.title.value)}</h4>${workTaskTable(m.tasks)}`).join('')).join('');
      parts.push(group(`goal-${g.id.value}`, `Goal: ${fieldValue(g.title)}`, `${srcLine(g.source_evidence)}${inner}`, fieldValue(g.status)));
    }
  }
  if (wantOp) {
    for (const o of workData.operations) {
      if (scope && scope.containerId && o.id.value !== scope.containerId) continue;
      const inner = o.workflows.map((w) => `<h4 class="work-milestone">Workflow: ${esc(w.title.value)}</h4>${workTaskTable(w.tasks)}`).join('');
      parts.push(group(`op-${o.id.value}`, `Operation: ${fieldValue(o.title)}`, `${srcLine(o.source_evidence)}${inner}`, fieldValue(o.cadence, fieldValue(o.status))));
    }
  }
  if (workData.blockers.length) {
    parts.push(group('work-blockers', 'Blockers', workData.blockers.map((b) =>
      `<div class="trace-row"><span>${esc(fieldValue(b.item))} <span class="odim">${esc(fieldValue(b.scope, ''))}</span></span><b>${esc(fieldValue(b.condition))} → ${esc(fieldValue(b.unblocking_action))}</b></div>`).join(''), workData.blockers.length));
  }
  return parts.join('') || '<p class="odim">No goals or operations in this project.</p>';
}

function renderWorkNav() {
  const nav = $('#workNav'); if (!nav) return;
  if (!workData || workData.hasNative === false) {
    nav.innerHTML = `<div class="work-nav-empty">${workData === null ? 'No project selected.' : 'No os/ work layout.'}</div>`;
    return;
  }
  const taskCount = (tasks) => tasks.filter((t) => fieldValue(t.status) !== 'done').length;
  const tree = (key, label, items, kids) => {
    const collapsed = !!view.navCollapsed[key];
    return `<div class="work-tree"><button type="button" class="work-tree-head" data-navtoggle="${esc(key)}" aria-expanded="${!collapsed}"><span class="chev">${collapsed ? '▶' : '▼'}</span>${esc(label)}<span class="count">${items.length}</span></button>${collapsed ? '' : kids}</div>`;
  };
  const goals = tree('goals', 'Goals', workData.goals, workData.goals.map((g) => {
    const open = fieldValue(g.status) !== 'done';
    const n = g.phases.reduce((acc, p) => acc + p.milestones.reduce((a, m) => a + taskCount(m.tasks), 0), 0);
    return `<button type="button" class="work-node${view.workScope?.containerId === g.id.value ? ' active' : ''}" data-scope-type="goal" data-scope-id="${esc(g.id.value)}">${esc(fieldValue(g.title))}<span class="count">${n}</span>${open ? '' : ' ✓'}</button>`;
  }).join(''));
  const ops = tree('operations', 'Operations', workData.operations, workData.operations.map((o) => {
    const n = o.workflows.reduce((a, w) => a + taskCount(w.tasks), 0);
    return `<button type="button" class="work-node${view.workScope?.containerId === o.id.value ? ' active' : ''}" data-scope-type="operation" data-scope-id="${esc(o.id.value)}">${esc(fieldValue(o.title))}<span class="count">${n}</span></button>`;
  }).join(''));
  nav.innerHTML = goals + ops;
  nav.querySelectorAll('[data-navtoggle]').forEach((el) => el.addEventListener('click', () => { view.navCollapsed[el.dataset.navtoggle] = !view.navCollapsed[el.dataset.navtoggle]; renderWorkNav(); }));
  nav.querySelectorAll('[data-scope-type]').forEach((el) => el.addEventListener('click', () => {
    view.workScope = { streamType: el.dataset.scopeType, containerId: el.dataset.scopeId };
    view.tab = 'work'; view.sidebarOpen = false;
    feedback(`Scoped to ${el.dataset.scopeType}: ${el.dataset.scopeId}`);
    render();
  }));
}

// --- governed transitions + approval dialog ----------------------------------

// D32 promotion: a discovered candidate rides the full governed lifecycle —
// intent → plan (approve-class) → the SAME approval dialog as every other
// write → execute → ledger. The sidecar holds the pending intent; durable
// truth lands only in os/topology.md after approval.
async function runPromotion(candidateId) {
  const c = discovery && discovery.candidates ? discovery.candidates.find((x) => x.id === candidateId) : null;
  if (!c) { feedback('Candidate not found — rescan and retry'); return; }
  const idSlug = candidateManifestId(c);
  try {
    const res = await postMutation('/api/intents', { kind: 'promote-topology', payload: { nodes: [{ id: idSlug, kind: c.kind, name: c.name, promotedFrom: c.sourcePath, matchedBy: c.matchedBy }], edges: [] } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { feedback(`Promotion intent refused (${res.status}): ${data.error || 'unknown error'}`); return; }
    const planRes = await postMutation(`/api/intents/${encodeURIComponent(data.intent.id)}/plan`, {});
    const planData = await planRes.json().catch(() => ({}));
    if (!planRes.ok) { feedback(`Promotion plan refused (${planRes.status}): ${planData.error || 'unknown error'}`); return; }
    if (planData.approval) {
      // auto-class by project policy: approved by policy, execute now.
      const execRes = await postMutation(`/api/plans/${encodeURIComponent(planData.plan.id)}/execute`, {});
      const execData = await execRes.json().catch(() => ({}));
      feedback(execRes.ok ? `Promoted ${c.name} → os/topology.md · ledgered` : `Promotion execute refused: ${execData.error || execRes.status}`);
      await load();
      return;
    }
    openApprovalDialog(planData.plan);
  } catch (err) { feedback(`Promotion failed: ${String(err)}`); }
}

async function runTransition(taskId, to) {
  try {
    const res = await postMutation('/api/work/tasks/transition', { taskId, to });
    const data = await res.json().catch(() => ({}));
    if (res.status === 202 && data.plan) { openApprovalDialog(data.plan); return; }
    if (!res.ok) { feedback(`Transition refused (${res.status}): ${data.error || 'unknown error'}`); render(); return; }
    feedback(`Task ${taskId} → ${to} (${data.execution ? data.execution.status : 'done'}) · ledgered`);
    await load();
  } catch (err) { feedback(`Transition failed: ${String(err)}`); render(); }
}

function pendingApprovals() {
  // 'planned' non-auto plans await approval; 'approved' plans (any class,
  // including an auto plan whose execution failed) await a retry of execute —
  // both must stay reachable so a plan is never stranded off the UI.
  return (lifecycleData?.plans || []).filter((p) =>
    (p.status === 'planned' && p.class !== 'auto') || p.status === 'approved');
}

function openApprovalDialog(plan) {
  pendingPlan = plan;
  const dlg = $('#approvalDialog'); if (!dlg) return;
  $('#apSummary').textContent = plan.summary || plan.opName;
  $('#apMeta').innerHTML = `<div class="trace-row"><span>plan</span><b>${esc(plan.id)} · class ${esc(plan.class)}</b></div><div class="trace-row"><span>plan hash</span><b>${esc(String(plan.planHash).slice(0, 16))}…</b></div>`;
  const diff = plan.preview?.diff;
  $('#apPreview').textContent = diff
    ? diff.map((c) => `${c.type === 'add' ? '+' : '-'} ${c.text}`).join('\n') || '(no line changes)'
    : (plan.preview?.command || '(no preview)');
  const founder = plan.class === 'founder';
  $('#apConfirmWrap').hidden = !founder;
  $('#apConfirm').value = '';
  const errEl = $('#apError'); errEl.hidden = true; errEl.textContent = '';
  if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
}
function closeApprovalDialog() {
  pendingPlan = null;
  const dlg = $('#approvalDialog'); if (!dlg) return;
  if (typeof dlg.close === 'function' && dlg.open) dlg.close(); else dlg.removeAttribute('open');
}
async function approveAndExecute() {
  if (!pendingPlan) return;
  const errEl = $('#apError');
  const id = encodeURIComponent(pendingPlan.id);
  try {
    // Approve is skipped when the plan is already approved (a retry after a
    // failed execute): re-approving a non-planned plan 409s, which would strand
    // an approved-but-unexecuted plan with no way to run it. Keep the dialog
    // open on failure and refresh lifecycle so its true status is reflected.
    if (pendingPlan.status !== 'approved') {
      const body = pendingPlan.class === 'founder' ? { confirm: $('#apConfirm').value.trim() } : {};
      const ar = await postMutation(`/api/plans/${id}/approve`, body);
      const aData = await ar.json().catch(() => ({}));
      if (!ar.ok) { errEl.textContent = aData.error || `approval refused (${ar.status})`; errEl.hidden = false; return; }
      pendingPlan.status = 'approved';
    }
    const xr = await postMutation(`/api/plans/${id}/execute`, {});
    const xData = await xr.json().catch(() => ({}));
    if (!xr.ok) {
      errEl.textContent = xData.error || `execution refused (${xr.status})`; errEl.hidden = false;
      await load(); // reflect the now-approved plan in Pending approvals so a retry is reachable
      return;
    }
    feedback(`Executed ${pendingPlan.opName}: ${xData.execution.status} · ledgered`);
    closeApprovalDialog();
    await load();
  } catch (err) { errEl.textContent = String(err); errEl.hidden = false; }
}

// --- assistant dock (region 4 mode) -------------------------------------------

const ASSISTANT_MODES = [
  ['chief-of-staff', 'Chief of Staff'],
  ['translator', 'Translator'],
  ['chat', 'Chat'],
];

function assistantContext() {
  // Operator-visible context (D31): only the compact queue summary, never file
  // contents. Shown verbatim in the dock so the operator sees what is sent.
  if (!queueData || queueData.hasNative === false) return '';
  const line = (k, entries) => `${k}: ${entries.map((e) => `${fieldValue(e.task.id, '')}[${fieldValue(e.task.status)}] ${fieldValue(e.task.title)}`).join('; ') || 'none'}`;
  return [line('Today', queueData.sections.today), line('Rolled over', queueData.sections.rolledOver)].join('\n');
}

function renderAssistant(inspector) {
  const configured = !!(project && project.assistant && project.assistant.configured);
  const transcript = assistant.transcripts[assistant.mode];
  const modeTabs = ASSISTANT_MODES.map(([id, label]) =>
    `<button type="button" class="assistant-mode${assistant.mode === id ? ' active' : ''}" data-assistant-mode="${id}">${label}</button>`).join('');
  const ctx = assistantContext();
  const body = !configured
    ? `<div class="assistant-empty"><p><b>Assistant not configured.</b></p><p class="odim">Create <code>assistant-config.json</code> in the app folder (gitignored) with a <code>cli</code> or <code>http</code> provider. See README §Assistant. Keys never enter this repo or the ledger.</p></div>`
    : (transcript.length
      ? transcript.map((m) => `<div class="assistant-msg assistant-${m.role}"><span class="assistant-role">${m.role === 'user' ? 'YOU' : 'ASSISTANT'}</span><div>${renderMarkdown(m.text)}</div></div>`).join('')
      : `<div class="assistant-empty odim">${assistant.mode === 'chief-of-staff' ? 'Ask for a read on today\'s queue, or what to delegate. Proposals come back as suggestions — every action still needs your approval.' : assistant.mode === 'translator' ? 'Paste rough notes; get back a structured task spec or prompt.' : 'Ask anything about the current work state.'}</div>`);
  inspector.innerHTML = `
    <div class="right-mode-tabs"><button type="button" class="right-mode" data-right-mode="inspector">Inspector</button><button type="button" class="right-mode active" data-right-mode="assistant">Assistant</button></div>
    <div class="assistant-dock">
      <div class="assistant-modes">${modeTabs}</div>
      <div class="assistant-transcript" id="assistantTranscript">${body}${assistant.busy ? '<div class="assistant-msg odim">thinking…</div>' : ''}</div>
      ${ctx ? `<details class="assistant-ctx"><summary>Context sent with each message</summary><pre>${esc(ctx)}</pre></details>` : ''}
      <div class="assistant-input">
        <textarea id="assistantText" rows="3" placeholder="${configured ? 'Message the assistant…' : 'Configure the assistant first'}" ${configured && !assistant.busy ? '' : 'disabled'}></textarea>
        <button type="button" class="command-button primary" id="assistantSend" ${configured && !assistant.busy ? '' : 'disabled'}>Send</button>
      </div>
    </div>`;
  inspector.querySelectorAll('[data-right-mode]').forEach((el) => el.addEventListener('click', () => { view.rightMode = el.dataset.rightMode; renderInspector(); }));
  inspector.querySelectorAll('[data-assistant-mode]').forEach((el) => el.addEventListener('click', () => { assistant.mode = el.dataset.assistantMode; renderInspector(); }));
  const sendBtn = inspector.querySelector('#assistantSend');
  const text = inspector.querySelector('#assistantText');
  const send = async () => {
    const message = text.value.trim(); if (!message || assistant.busy) return;
    assistant.transcripts[assistant.mode].push({ role: 'user', text: message });
    assistant.busy = true; renderInspector();
    try {
      const res = await postMutation(`/api/assistant/${assistant.mode}/messages`, { message, context: assistantContext() });
      const data = await res.json().catch(() => ({}));
      assistant.transcripts[assistant.mode].push({ role: 'assistant', text: res.ok ? data.reply : `⚠ ${data.error || `HTTP ${res.status}`}` });
    } catch (err) {
      assistant.transcripts[assistant.mode].push({ role: 'assistant', text: `⚠ ${String(err)}` });
    } finally {
      assistant.busy = false; renderInspector();
      const t = $('#assistantTranscript'); if (t) t.scrollTop = t.scrollHeight;
    }
  };
  if (sendBtn) sendBtn.addEventListener('click', send);
  if (text) text.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
}

function renderInspector() {
  const inspector = $('#inspector'); if (!inspector) return;
  if (view.rightMode === 'assistant') { renderAssistant(inspector); return; }
  const modeTabs = '<div class="right-mode-tabs"><button type="button" class="right-mode active" data-right-mode="inspector">Inspector</button><button type="button" class="right-mode" data-right-mode="assistant">Assistant</button></div>';
  const wireModeTabs = () => inspector.querySelectorAll('[data-right-mode]').forEach((el) => el.addEventListener('click', () => { view.rightMode = el.dataset.rightMode; renderInspector(); }));
  const item = objectRegistry.get(view.selectedObjectId);
  if (!item) {
    inspector.innerHTML = `${modeTabs}<div class="inspector-placeholder">Select a graph node, card, or table row. The inspector shows one derived UI record over the existing source-backed object, never a duplicate truth.</div>`;
    wireModeTabs();
    return;
  }
  const overview = `<dl class="inspector-kv"><dt>Type</dt><dd>${esc(item.type)}</dd><dt>State</dt><dd>${esc(item.state)}</dd><dt>Owner / authority</dt><dd>${esc(item.owner)} · ${esc(item.sourceAuthority)}</dd><dt>Timestamp</dt><dd>${esc(item.timestamp)}</dd><dt>Provenance</dt><dd>${esc(item.provenance)}</dd>${item.overview.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>${item.sourcePath ? '' : '<p class="odim">No directly viewable source file is available for this derived object.</p>'}`;
  const evidence = renderEvidenceView(item);
  const relationships = item.relationships.length ? `<ul class="detail-list">${item.relationships.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : '<p class="odim">No source-backed relationship is structured for this selection.</p>';
  const content = view.inspectorTab === 'evidence' ? evidence : view.inspectorTab === 'relationships' ? relationships : overview;
  const sourceAction = item.sourcePath ? `<button type="button" class="inspector-action" data-evidence-path="${esc(item.sourcePath)}">Load read-only source → ${esc(item.sourcePath)}</button>` : '';
  inspector.innerHTML = `${modeTabs}<div class="inspector-head"><div class="region-label">Selected object</div><h2>${esc(item.title)}</h2><div class="inspector-id">${esc(item.id)}</div></div><div class="inspector-tabs"><button type="button" data-inspector-tab="overview" class="${view.inspectorTab === 'overview' ? 'active' : ''}">Overview</button><button type="button" data-inspector-tab="evidence" class="${view.inspectorTab === 'evidence' ? 'active' : ''}">Evidence</button><button type="button" data-inspector-tab="relationships" class="${view.inspectorTab === 'relationships' ? 'active' : ''}">Relationships</button></div><div class="inspector-body">${content}${sourceAction}<div class="detail-sec">Read-only action</div><p class="odim">${esc(item.nextAction)}</p></div>`;
  inspector.querySelectorAll('[data-inspector-tab]').forEach((button) => button.addEventListener('click', () => { view.inspectorTab = button.dataset.inspectorTab; renderInspector(); }));
  inspector.querySelectorAll('[data-evidence-path]').forEach((button) => button.addEventListener('click', () => openEvidence(button.dataset.evidencePath, item.id)));
  inspector.querySelectorAll('[data-evidence-mode]').forEach((button) => button.addEventListener('click', () => { view.evidenceMode = button.dataset.evidenceMode; renderInspector(); }));
  wireModeTabs();
}
// Bottom status strip (D31): sprint progress, workspace/git health, and
// commit/push readiness — always visible above the trace sections.
function renderStatusStrip() {
  const s = sprintData && sprintData.hasNative ? sprintData : null;
  const h = repoHealth && !repoHealth.fatal ? repoHealth : null;
  const sprint = s
    ? `<span class="strip-item" title="done / total tasks">SPRINT ${s.counts.done}/${s.counts.done + s.counts.planned + s.counts.active + s.counts.blocked} · ${s.completionPct ?? 0}%</span>
       <span class="strip-item" title="estimated hours remaining">EST ${s.estRemaining}h left</span>
       <span class="strip-item${s.counts.rolledOver ? ' strip-warn' : ''}" title="tasks scheduled in the past and not done">ROLLOVER ${s.counts.rolledOver}</span>`
    : '<span class="strip-item odim">SPRINT —</span>';
  const git = h && h.isRepo
    ? `<span class="strip-item">⎇ ${esc(h.branch || '?')}</span>
       <span class="strip-item${h.clean ? '' : ' strip-warn'}" title="${esc(h.safeReason || '')}">${h.clean ? 'CLEAN' : `DIRTY ${h.counts.staged}s/${h.counts.unstaged}u/${h.counts.untracked}?`}</span>
       <span class="strip-item" title="ahead/behind upstream">${h.upstream && h.upstream.exists ? `↑${h.upstream.ahead ?? '?'} ↓${h.upstream.behind ?? '?'}` : 'no upstream'}</span>`
    : `<span class="strip-item odim">${h ? esc(h.safeReason || 'no repo') : 'git —'}</span>`;
  const chain = ledgerData && ledgerData.chain
    ? `<span class="strip-item${ledgerData.chain.ok ? '' : ' strip-bad'}" title="audit ledger hash chain">LEDGER ${ledgerData.chain.ok ? `OK · ${ledgerData.chain.length}` : 'BROKEN'}</span>`
    : '';
  const pending = pendingApprovals().length
    ? `<span class="strip-item strip-warn">APPROVALS ${pendingApprovals().length}</span>` : '';
  // Safe named git actions (D31 step 5): each button raises an intent through
  // the governed lifecycle; readiness verdicts disable unsafe actions with an
  // explicit reason (never silently).
  const wr = h && h.writeReadiness;
  const gitBtn = (op, label, r, extra = '') => r
    ? `<button type="button" class="command-button task-action" data-git-op="${op}" ${r.ok ? '' : 'disabled'} title="${esc(r.ok ? (r.warning || r.reason) : `unavailable: ${r.reason}`)}">${label}${extra}</button>`
    : '';
  const actions = wr ? `<span class="strip-sep"></span>
    ${gitBtn('git-add', 'Stage all', wr.gitAdd)}
    ${gitBtn('git-commit', 'Commit…', wr.gitCommit)}
    ${gitBtn('git-branch', 'Branch…', wr.gitBranch)}
    ${gitBtn('git-switch', 'Switch…', wr.gitSwitch, wr.gitSwitch.warning ? ' ⚠' : '')}
    ${gitBtn('git-push', 'Push…', wr.gitPush)}` : '';
  return `<div class="status-strip" role="status" aria-label="Sprint and workspace status">${sprint}<span class="strip-sep"></span>${git}<span class="strip-sep"></span>${chain}${pending}${actions}</div>`;
}

// Raise a named git intent → plan → approval dialog. Push is founder class:
// the dialog demands the typed plan id. Nothing executes without the dialog.
async function runGitAction(op) {
  const payload = {};
  if (op === 'git-commit') {
    const message = window.prompt('Commit message (staged files only):');
    if (message === null || !message.trim()) return;
    payload.message = message.trim();
  }
  if (op === 'git-branch' || op === 'git-switch') {
    const name = window.prompt(op === 'git-branch' ? 'New branch name (creates and switches):' : 'Branch to switch to:');
    if (name === null || !name.trim()) return;
    payload.name = name.trim();
  }
  try {
    const ir = await postMutation('/api/intents', { kind: op, payload });
    const iData = await ir.json().catch(() => ({}));
    if (!ir.ok) { feedback(`Intent refused: ${iData.error || ir.status}`); render(); return; }
    const pr = await postMutation(`/api/intents/${encodeURIComponent(iData.intent.id)}/plan`, {});
    const pData = await pr.json().catch(() => ({}));
    if (!pr.ok) { feedback(`Plan refused (${pr.status}): ${pData.error || 'unknown'}`); render(); return; }
    openApprovalDialog(pData.plan);
  } catch (err) { feedback(`Git action failed: ${String(err)}`); render(); }
}
function renderBottomPanel() {
  const panel = $('#bottomPanel'); if (!panel || !state) return;
  const audit = repoHealth?.audit || {}; const validation = repoHealth?.validationCommands || [];
  const sourceTraces = `<div class="bottom-section"><div class="bottom-head"><h2>Source-backed validation</h2><span>${pill(audit.everRun ? audit.overall || 'unknown' : 'never run', audit.overall === 'pass' ? 'green' : audit.overall === 'fail' ? 'red' : 'grey')}</span></div><div class="trace-row"><span>state parsed</span><b>${esc(state.generatedAt)}</b></div><div class="trace-row"><span>repo audit</span><b>${esc(audit.lastRunLabel || 'never run')} · ${esc(audit.freshness || 'unknown')}</b></div><div class="trace-row"><span>topology</span><b>${state.counts.topologyEdges} edges · ${state.counts.topologyCanonicalEdges} Canonical</b></div></div>`;
  const checks = `<div class="bottom-section"><div class="bottom-head"><h2>Validation trace</h2><span class="odim">read-only records</span></div>${validation.map((c) => `<div class="trace-row"><span>${esc(c.label)}</span><b>${esc(c.status)} · ${esc(c.currency)} · ${esc(c.ranAtLabel || 'never run')}</b></div>`).join('') || '<p class="odim">No validation status is available.</p>'}</div>`;
  const feedbackRows = view.feedback.length ? view.feedback.map((entry) => `<div class="trace-row"><span>${esc(monoTime(entry.at))}</span><b>${esc(entry.message)}</b></div>`).join('') : '<p class="odim">No shell interactions recorded this session.</p>';
  const ephemeral = `<div class="bottom-section"><div class="bottom-head"><h2>Ephemeral session feedback</h2><span class="ephemeral-note">NOT SOURCE-BACKED</span></div><p class="ephemeral-note">In-memory UI feedback only. It is not persisted and does not alter source files.</p>${feedbackRows}</div>`;
  // Gate G sections: pending approvals (explicit operator action) and the
  // Visual Ledger (immutable, hash-chained; rollback is the post-execution override).
  const pend = pendingApprovals();
  const approvalsSec = `<div class="bottom-section"><div class="bottom-head"><h2>Pending approvals</h2><span>${pend.length ? pill(`${pend.length} waiting`, 'amber') : pill('none', 'grey')}</span></div>${pend.length
    ? pend.map((p) => `<div class="trace-row"><span>${esc(p.id)} · ${esc(p.class)}</span><b>${esc(p.summary || p.opName)} <button type="button" class="command-button task-action" data-review-plan="${esc(p.id)}">Review…</button></b></div>`).join('')
    : '<p class="odim">No plan is waiting for approval.</p>'}</div>`;
  const events = (ledgerData?.events || []).slice(-8).reverse();
  const rollbackable = new Set((lifecycleData?.executions || []).filter((e) => e.status === 'succeeded' && (e.preimages || []).length).map((e) => e.id));
  const ledgerSec = `<div class="bottom-section"><div class="bottom-head"><h2>Visual Ledger</h2><span>${ledgerData?.chain ? (ledgerData.chain.ok ? pill('chain ok', 'green') : pill('chain broken', 'red')) : pill('unavailable', 'grey')}</span></div>${events.length
    ? events.map((e) => `<div class="trace-row"><span>#${e.seq} ${esc(monoTime(e.ts))}</span><b>${esc(e.type)}${e.summary ? ` · ${esc(e.summary)}` : ''}${e.executionId && e.type === 'execution-succeeded' && rollbackable.has(e.executionId) ? ` <button type="button" class="command-button task-action" data-rollback="${esc(e.executionId)}">Roll back…</button>` : ''}</b></div>`).join('')
    : '<p class="odim">No governed actions have been ledgered yet.</p>'}</div>`;
  panel.innerHTML = renderStatusStrip() + `<div class="bottom-grid">${approvalsSec}${ledgerSec}${sourceTraces}${checks}${ephemeral}</div>`;
  panel.querySelectorAll('[data-review-plan]').forEach((el) => el.addEventListener('click', () => {
    const plan = (lifecycleData?.plans || []).find((p) => p.id === el.dataset.reviewPlan);
    if (plan) openApprovalDialog(plan);
  }));
  panel.querySelectorAll('[data-git-op]').forEach((el) => el.addEventListener('click', () => runGitAction(el.dataset.gitOp)));
  panel.querySelectorAll('[data-rollback]').forEach((el) => el.addEventListener('click', async () => {
    const id = el.dataset.rollback;
    const typed = window.prompt(`Rollback is a founder-class override. Type the execution id to confirm:\n${id}`);
    if (typed === null) return;
    const res = await postMutation(`/api/executions/${encodeURIComponent(id)}/rollback`, { confirm: typed.trim() });
    const data = await res.json().catch(() => ({}));
    feedback(res.ok ? `Rolled back ${id} · ledgered` : `Rollback refused: ${data.error || res.status}`);
    await load();
  }));
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
  $('#loadMeta').textContent = `as of ${state.asOfDate} · reads source-backed · writes governed (D31)`;
  const screens = { daily: renderDaily, work: renderWork, overview: renderOverview, board: renderBoard, queue: renderQueue, topology: renderTopology, roadmap: renderRoadmap, milestones: renderMilestones, review: renderReview, learning: renderLearning, sources: renderSources, health: renderHealth };
  $('#main').innerHTML = (screens[view.tab] || renderDaily)();
  renderWorkNav(); renderInspector(); renderBottomPanel(); wireDynamic();
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
  // D32: strategy override is presentation-only session state; loop selection
  // reuses the hot/dim edge grammar and is mutually exclusive with node selection.
  main.querySelectorAll('[data-strategy]').forEach((el) => el.addEventListener('click', (event) => { event.stopPropagation(); view.graphStrategy = el.dataset.strategy; view.loopSel = null; feedback(`Layout strategy: ${el.dataset.strategy} (session only, presentation-only)`); render(); }));
  main.querySelectorAll('[data-loop]').forEach((el) => el.addEventListener('click', (event) => { event.stopPropagation(); view.loopSel = view.loopSel === el.dataset.loop ? null : el.dataset.loop; view.graphSel = null; feedback(view.loopSel ? `Loop highlighted: ${view.loopSel}` : 'Loop selection cleared'); render(); }));
  main.querySelectorAll('[data-toggle-discovered]').forEach((el) => el.addEventListener('click', (event) => { event.stopPropagation(); view.showDiscovered = !view.showDiscovered; feedback(`Discovered candidates ${view.showDiscovered ? 'shown' : 'hidden'}`); render(); }));
  main.querySelectorAll('[data-rescan]').forEach((el) => el.addEventListener('click', async (event) => { event.stopPropagation(); feedback('Rescanning project for candidates…'); try { discovery = await (await fetch('/api/discovery?rescan=1', { cache: 'no-store' })).json(); } catch (err) { discovery = null; } feedback('Discovery rescan complete'); render(); }));
  main.querySelectorAll('[data-promote]').forEach((el) => el.addEventListener('click', (event) => { event.stopPropagation(); el.disabled = true; runPromotion(el.dataset.promote); }));
  // Governed task transitions (D31): every click is an intent through the
  // lifecycle; auto-class runs immediately (ledgered), others open approval.
  main.querySelectorAll('[data-transition]').forEach((el) => el.addEventListener('click', (event) => {
    event.stopPropagation();
    el.disabled = true;
    runTransition(el.dataset.transition, el.dataset.to);
  }));
}
function goTab(tab) { view.tab = tab; view.filterStatus = ''; view.graphSel = null; view.loopSel = null; view.sidebarOpen = false; feedback(`Switched to ${tabLens(tab)} lens: ${tab}`); render(); }
function goLens(lens) { const spec = LENS_REGISTRY[lens]; if (!spec) return; view.tab = spec.defaultTab; view.filterStatus = ''; view.sidebarOpen = false; if (spec.inspectorMode) { view.inspectorOpen = true; view.inspectorTab = spec.inspectorMode; } feedback(`Lens selected: ${lens}`); render(); }

async function load(attempt = 0) {
  const button = $('#refreshBtn'); button.disabled = true; button.textContent = 'Refreshing…'; $('#loadMeta').textContent = 'refreshing source-backed state…';
  try {
    state = await (await fetch('/api/state', { cache: 'no-store' })).json();
    try { repoHealth = await (await fetch('/api/repo-health', { cache: 'no-store' })).json(); } catch (err) { repoHealth = { fatal: String(err) }; }
    try { discovery = await (await fetch('/api/discovery', { cache: 'no-store' })).json(); } catch (err) { discovery = null; }
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
    // Gate G projections. Each degrades independently — a missing os/ layout
    // or an older server yields empty shapes, never a broken shell.
    try { workData = await (await fetch('/api/work', { cache: 'no-store' })).json(); } catch { workData = null; }
    try { queueData = await (await fetch('/api/queue', { cache: 'no-store' })).json(); } catch { queueData = null; }
    try { sprintData = await (await fetch('/api/sprint', { cache: 'no-store' })).json(); } catch { sprintData = null; }
    try { lifecycleData = await (await fetch('/api/lifecycle', { cache: 'no-store' })).json(); } catch { lifecycleData = null; }
    try { ledgerData = await (await fetch('/api/ledger', { cache: 'no-store' })).json(); } catch { ledgerData = null; }
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
  if (!project || project.configured === false) {
    el.textContent = 'No project';
    el.title = '';
    $('#projectBtn')?.classList.remove('switched');
    return;
  }
  el.textContent = project.label || 'project';
  el.title = project.currentRoot || '';
  $('#projectBtn')?.classList.remove('switched');
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
  $('#projectDialogCurrent').textContent = project && project.currentRoot ? project.currentRoot : 'No project configured';
  $('#projectPath').value = project && project.configured ? project.currentRoot : '';
  // Native picker is the primary action when the server reports it available.
  const native = !!(project && project.pickers && project.pickers.native);
  $('#projectSelectFolder').hidden = !native;
  $('#projectSelectHint').hidden = !native;
  renderRecent();
  // Start the in-app explorer at the active project folder (or drive root if none).
  browse = null; $('#pbList').innerHTML = '<div class="pb-empty">Loading…</div>';
  browseTo(project && project.configured ? project.currentRoot : '');
  const errEl = $('#projectError'); errEl.hidden = true; errEl.textContent = '';
  // Enable/disable Clear button: only useful when a project is active.
  const clearBtn = $('#projectReset'); if (clearBtn) clearBtn.disabled = !(project && project.configured);
  const warnEl = $('#projectWarn');
  const warn = project && (
    project.restoreWarning
    || (project.persistWarning ? `Not saved for next launch (${project.persistWarning}) — no project will be active on restart.` : '')
    || (project.configured && !project.looksLikeRepo ? 'This folder has no agents/ or CLAUDE.md — it may not be a governance repo.' : '')
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
  // pathValue = '' means "clear project" (root= empty param triggers null on server).
  const target = typeof pathValue === 'string' ? pathValue : '';
  try {
    const res = await guardedFetch('/api/project?root=' + encodeURIComponent(target));
    const data = await res.json();
    if (data.error) { if (errEl) { errEl.textContent = data.error; errEl.hidden = false; } return false; }
    project = data;
    if (data.actionToken) actionToken = data.actionToken;
    // A new project invalidates any selection/evidence from the previous one.
    view.selectedObjectId = null; view.evidence = null; view.graphSel = null;
    feedback(data.configured === false ? 'Project cleared' : `Active project: ${data.currentRoot}`);
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
  $('#logo').addEventListener('click', () => goTab('daily'));
  $('#apApprove').addEventListener('click', approveAndExecute);
  $('#apCancel').addEventListener('click', closeApprovalDialog);
  $('#apConfirm').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); approveAndExecute(); } });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { view.sidebarOpen = false; if (window.innerWidth <= 940) view.inspectorOpen = false; render(); } });
  // Queue keyboard reach: j/k move focus across queue rows; Enter/Space on a
  // row's action buttons already works natively (buttons). Never auto-approves.
  document.addEventListener('keydown', (event) => {
    if (view.tab !== 'daily' || event.target.closest('input, textarea, select, dialog')) return;
    if (event.key !== 'j' && event.key !== 'k') return;
    const rows = [...document.querySelectorAll('.queue-row')];
    if (!rows.length) return;
    rows.forEach((r) => r.setAttribute('tabindex', '0'));
    const i = rows.indexOf(document.activeElement);
    const next = event.key === 'j' ? Math.min(i + 1, rows.length - 1) : Math.max(i - 1, 0);
    rows[next].focus();
    event.preventDefault();
  });
}

if (hasDom) {
  bindShell();
  load();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isMarkdownPath,
    isSafeMarkdownHref,
    renderMarkdown,
    renderMarkdownInline,
  };
}
