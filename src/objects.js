'use strict';
// Object adapters for the three Operational-Core objects, implementing the
// Gate C-approved Parser & Derivation Contract §§2–4 exactly. Semantics are
// fixed by that contract and may not change without founder approval.

const { field, nys, slugify, computeFreshness, findTable, extractTables } = require('./parse');

const MANUAL_TAG_RE = /\[manual:\s*\d{4}-\d{2}-\d{2}\]/;

// ---------------------------------------------------------------------------
// §2 — Strategic Initiative (one object per strategic_initiatives.md body row)
// ---------------------------------------------------------------------------
const SI_STATUS_ENUM = ['active', 'proposed', 'paused', 'complete', 'archived'];

function adaptStrategicInitiatives(file, thresholds, today) {
  const objects = [];
  const errors = [];
  if (file.error) return { objects, errors: [fileError(file)] };
  const table = findTable(file.content, ['Initiative', 'Stage', 'Status', 'Owner', 'Success Definition']);
  if (!table) return { objects, errors: [{ path: file.path, error: 'strategic_initiatives body table not found' }] };
  const freshness = computeFreshness(file.frontmatter, thresholds, today);

  for (const row of table.rows) {
    const c = row.cells;
    if (c.length < 5) { errors.push({ path: file.path, error: `row at line ${row.line} has ${c.length} cells, expected 5` }); continue; }
    const name = c[0];
    // status: token before the first ' — ' separator, lowercased, matched to enum (§2)
    const sepIdx = c[2].indexOf(' — ');
    const rawToken = (sepIdx === -1 ? c[2] : c[2].slice(0, sepIdx)).trim().toLowerCase();
    const statusOk = SI_STATUS_ENUM.includes(rawToken);
    const remainder = sepIdx === -1 ? '' : c[2].slice(sepIdx + 3).trim();
    objects.push({
      objectType: 'strategic_initiative',
      name: field(name, 'Canonical'),
      stage: field(c[1], 'Canonical'),
      status: statusOk ? field(rawToken, 'Derived') : nys('Derived'),
      ...(remainder ? { status_note: field(remainder, 'Derived') } : {}),
      owner: field(c[3], 'Canonical'),
      success_definition: field(c[4], 'Canonical'),
      id: field(slugify(name), 'Derived'),
      manual_flag: field(MANUAL_TAG_RE.test(c.join(' ')), 'Derived'),
      freshness,
      source_evidence: field({ file: file.path, locator: `row "${name}" (line ${row.line})` }, 'Derived'),
    });
  }
  return { objects, errors };
}

// ---------------------------------------------------------------------------
// §3 — Work Item (one object per weekly_priorities.md body row)
// ---------------------------------------------------------------------------
const WI_STATUS_ENUM = ['active', 'queued', 'completed', 'blocked'];

function adaptWeeklyPriorities(file, initiatives, thresholds, today) {
  const objects = [];
  const errors = [];
  if (file.error) return { objects, errors: [fileError(file)] };
  const table = findTable(file.content, ['Rank', 'Action', 'Owner', 'Initiative', 'Est', 'Status']);
  if (!table) return { objects, errors: [{ path: file.path, error: 'weekly_priorities body table not found' }] };
  const freshness = computeFreshness(file.frontmatter, thresholds, today);
  const sprintWeek = file.frontmatter && file.frontmatter.sprint_week
    ? field(file.frontmatter.sprint_week, 'Canonical') : nys('Canonical');

  // Initiative-name match: normalize dash variants + case (§3 initiative_link).
  const norm = (s) => String(s).toLowerCase().replace(/[—–-]+/g, '-').replace(/\s+/g, ' ').trim();
  const initiativeIndex = new Map(initiatives.map(o => [norm(o.name.value), o.id.value]));

  for (const row of table.rows) {
    const c = row.cells;
    if (c.length < 6) { errors.push({ path: file.path, error: `row at line ${row.line} has ${c.length} cells, expected 6` }); continue; }
    // status: the item-level token at the head of col 6, matched to the item vocab (§3);
    // remainder after the token (and its separator) is status_note.
    const m = c[5].match(/^(active|queued|completed|blocked)\b\s*(?:[—–:-]\s*)?(.*)$/is);
    const statusField = m ? field(m[1].toLowerCase(), 'Derived') : nys('Derived');
    const note = m ? m[2].trim() : c[5].trim();
    const linkedId = initiativeIndex.get(norm(c[3]));
    objects.push({
      objectType: 'work_item',
      rank: field(c[0], 'Canonical'),
      action: field(c[1], 'Canonical'),
      owner: field(c[2], 'Canonical'),
      initiative: field(c[3], 'Canonical'),
      initiative_link: linkedId ? field(linkedId, 'Derived') : nys('Derived'),
      estimate: field(c[4], 'Canonical'),
      status: statusField,
      ...(note ? { status_note: field(note, 'Derived') } : {}),
      manual_flag: field(MANUAL_TAG_RE.test(c[5]), 'Derived'),
      sprint_week: sprintWeek,
      freshness,
      source_evidence: field({ file: file.path, locator: `row ${c[0]} (line ${row.line})` }, 'Derived'),
    });
  }
  return { objects, errors };
}

// ---------------------------------------------------------------------------
// §4A — Decision-queue Approvals (Canonical family)
// ---------------------------------------------------------------------------
function adaptDecisionQueue(file, thresholds, today) {
  const objects = [];
  const errors = [];
  if (file.error) return { objects, errors: [fileError(file)] };
  const table = findTable(file.content, ['Decision', 'Consequence', 'Decision maker', 'Information needed']);
  if (!table) return { objects, errors: [{ path: file.path, error: 'decision_queue body table not found' }] };
  const freshness = computeFreshness(file.frontmatter, thresholds, today);

  for (const row of table.rows) {
    const c = row.cells;
    if (c.length < 5) { errors.push({ path: file.path, error: `row at line ${row.line} has ${c.length} cells, expected 5` }); continue; }
    const resolvedMarker = c[1].match(/^\*\*\[RESOLVED\s+(\d{4}-\d{2}-\d{2})\]\*\*/) || c[1].match(/^\*\*\[RESOLVED[^\]]*\]\*\*/);
    const state = resolvedMarker ? 'resolved' : 'open';
    const resolutionDate = resolvedMarker && resolvedMarker[1] ? resolvedMarker[1] : null;
    objects.push({
      objectType: 'approval',
      id: field(c[0], 'Canonical'),
      decision: field(c[1], 'Canonical'),
      consequence_if_deferred: field(c[2], 'Canonical'),
      decision_maker: field(c[3], 'Canonical'),
      information_needed: field(c[4], 'Canonical'),
      state: field(state, 'Derived'),
      ...(resolutionDate ? { resolution_date: field(resolutionDate, 'Derived') } : {}),
      source_kind: field('decision', 'Derived'),
      freshness,
      source_evidence: field({ file: file.path, locator: `decision ${c[0]} (line ${row.line})` }, 'Derived'),
    });
  }
  return { objects, errors };
}

// ---------------------------------------------------------------------------
// §4B — Dispatch-gate Approvals (Derived object family). Fields are Canonical
// only for direct explicit-label reads; missing anchors degrade to
// not-yet-structured (never a fuzzy-inferred gate).
// ---------------------------------------------------------------------------
function headingState(heading) {
  const h = heading.toLowerCase();
  if (h.includes('conditional')) return 'conditional';
  if (h.includes('pending dispatches')) return 'pending';
  if (h.includes('resolved dispatches')) return 'resolved';
  // "Active Dispatches" (plain) records transmitted, in-flight dispatches per the
  // file's own preamble; the transmitted mapping is a direct heading read.
  if (h.includes('transmitted') || /^active dispatches\s*$/.test(h.trim())) return 'transmitted';
  return null; // unmapped heading → state degrades to not-yet-structured
}

function adaptAgentDispatch(file, thresholds, today) {
  const objects = [];
  const errors = [];
  if (file.error) return { objects, errors: [fileError(file)] };
  const freshness = computeFreshness(file.frontmatter, thresholds, today);
  const lines = file.content.split(/\r?\n/);

  let currentHeading = null;
  let block = null;
  let blockStartLine = 0;

  const flush = () => {
    if (!block) return;
    const stateName = headingState(currentHeading || '');
    const headMatch = block.head.match(/^\*\*(.+?)\*\*\s*\|\s*Initiative:\s*(.+)$/);
    const triggerMatch = block.text.match(/\*\*Trigger:\*\*\s*([\s\S]*?)(?=\n\*\*[A-Z]|\n\s*$|$)/);
    const initiativeName = headMatch ? headMatch[2].trim() : null;
    objects.push({
      objectType: 'approval',
      id: initiativeName ? field(`dispatch-${slugify(initiativeName)}`, 'Derived') : nys('Derived'),
      title: triggerMatch ? field(collapse(triggerMatch[1]), 'Derived') : nys('Derived'),
      gate_condition: triggerMatch ? field(collapse(triggerMatch[1]), 'Derived') : nys('Derived'),
      target_agent: headMatch ? field(headMatch[1].trim(), 'Canonical') : nys('Canonical'),
      initiative: initiativeName ? field(initiativeName, 'Canonical') : nys('Canonical'),
      state: stateName ? field(stateName, 'Derived') : nys('Derived'),
      source_kind: field('dispatch-gate', 'Derived'),
      freshness,
      source_evidence: field({ file: file.path, locator: `block under "${currentHeading}" (line ${blockStartLine})` }, 'Derived'),
    });
    block = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.match(/^###\s+(.*)$/);
    if (heading) {
      flush();
      currentHeading = heading[1].trim();
      continue;
    }
    if (currentHeading === null) continue;
    const state = headingState(currentHeading);
    // Pending-dispatch table rows (initiatives without OS support)
    if (state === 'pending' && line.trim().startsWith('|') && !/^[\s|:-]+$/.test(line) && !/^\|\s*Initiative\s*\|/i.test(line)) {
      const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(s => s.trim());
      if (cells.length >= 3) {
        objects.push({
          objectType: 'approval',
          id: field(`dispatch-${slugify(cells[0])}`, 'Derived'),
          title: field(cells[2], 'Derived'),          // "What's needed" cell (§4B)
          gate_condition: field(cells[1], 'Derived'), // "Blocking reason" cell (§4B)
          target_agent: nys('Canonical'),             // no bolded agent anchor in the table → degrade
          initiative: field(cells[0], 'Canonical'),
          state: field('pending', 'Derived'),
          source_kind: field('dispatch-gate', 'Derived'),
          freshness,
          source_evidence: field({ file: file.path, locator: `pending table row "${cells[0]}" (line ${i + 1})` }, 'Derived'),
        });
      }
      continue;
    }
    // Prose dispatch blocks open with a bolded agent head line
    if (/^\*\*.+?\*\*\s*\|\s*Initiative:/.test(line)) {
      flush();
      block = { head: line.trim(), text: '' };
      blockStartLine = i + 1;
      continue;
    }
    if (block) block.text += line + '\n';
  }
  flush();
  return { objects, errors };
}

function collapse(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function fileError(file) {
  return { path: file.path, error: file.error };
}

module.exports = {
  adaptStrategicInitiatives,
  adaptWeeklyPriorities,
  adaptDecisionQueue,
  adaptAgentDispatch,
  SI_STATUS_ENUM,
  WI_STATUS_ENUM,
};
