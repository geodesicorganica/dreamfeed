'use strict';
// Brief B — the three fast-follow object adapters, implementing Gate C contract
// §5 (Milestone), §6 (Review), §7 (Learning Signal) exactly. Read-only. Object
// semantics unchanged by Gate C Amendment 1 (which only re-tiers topology edges).

const fs = require('fs');
const path = require('path');
const {
  REPO_ROOT, parseFile, detectSchemaFamily, discoverGovernanceFiles,
  field, nys, slugify, computeFreshness,
} = require('./parse');

// ---------------------------------------------------------------------------
// §5 — Milestone (FR12/FR13). Degraded by design: phase_label/scope_summary
// Derived from CLAUDE.md prose, target_timing Candidate, state not-yet-structured
// (no canonical milestone-completion field), connected_initiatives Derived by
// matching initiatives that name the phase. Untyped source → freshness nys.
// ---------------------------------------------------------------------------
function adaptMilestones(roadmapObjects, strategicInitiatives) {
  const objects = [];
  for (const r of roadmapObjects) {
    const phase = r.phase_label.value;
    const connected = strategicInitiatives
      .filter(si => si.success_definition && !si.success_definition.nys &&
        new RegExp(`\\b${phase.replace(/[.]/g, '\\.')}\\b`).test(
          `${si.name.value} ${si.status_note ? si.status_note.value : ''} ${si.success_definition.value}`))
      .map(si => si.id.value);
    objects.push({
      objectType: 'milestone',
      phase_label: r.phase_label,                 // Derived (roadmap term)
      scope_summary: r.scope_summary,             // Derived
      target_timing: r.target_timing,             // Candidate or nys
      connected_initiatives: connected.length ? field(connected, 'Derived') : nys('Derived'),
      state: nys('Candidate'),                     // no canonical completion field → never inferred complete
      freshness: nys('Derived'),                   // untyped roadmap source → no §3 threshold
      source_evidence: r.source_evidence,
    });
  }
  return { objects, errors: [] };
}

// ---------------------------------------------------------------------------
// §6 — Review (FR14). One object per internal artifact under agents/*/outputs/
// plus untyped product_spec.md files. Spans all three schema families; several
// fields are family-conditional. Surfaces only — no publish/rewrite/branding.
// ---------------------------------------------------------------------------
const GOV_LIFECYCLE = {
  draft: 'in-progress', staged: 'awaiting-review', pending: 'awaiting-review',
  active: 'live', approved: 'approved', published: 'published',
  complete: 'complete', resolved: 'resolved', archived: 'archived',
};

function adaptReviews(repoRoot, thresholds, today) {
  const objects = [];
  const errors = [];
  let files = [];
  try { files = discoverGovernanceFiles(repoRoot); } catch (err) { errors.push({ path: 'agents/', error: String(err.message || err) }); }

  // product_spec.md files are excluded from governance discovery (untyped) but are
  // reviewable artifacts — add them by name.
  const specGlobRoots = [path.join(repoRoot, 'agents', 'founder', 'outputs', 'product-specs')];
  for (const root of specGlobRoots) {
    walkFind(root, 'product_spec.md', files);
  }

  for (const abs of files) {
    const f = parseFile(abs);
    const rel = f.path;
    if (f.error) { errors.push({ path: rel, error: f.error }); continue; }
    const fm = f.frontmatter || {};
    const family = detectSchemaFamily(fm);
    const isGov = family === 'governance';
    const isContent = family === 'content';

    const title = deriveTitle(f, rel);
    const status = fm.status ? field(fm.status, 'Canonical') : nys('Canonical');
    const lifecycle = isGov && fm.status
      ? field(GOV_LIFECYCLE[String(fm.status).toLowerCase()] || fm.status, 'Derived')
      : (isContent && fm.lifecycle_stage ? field(fm.lifecycle_stage, 'Canonical') : nys(isContent ? 'Canonical' : 'Derived'));
    const producingAgent = fm.producing_agent ? field(fm.producing_agent, 'Canonical') : nys('Canonical');
    const related = deriveRelatedInitiative(fm);
    const freshness = isGov ? computeFreshness(fm, thresholds, today) : nys('Derived'); // content/untyped → no §3 threshold (Q2)
    const reviewNeed = deriveReviewNeed(fm, freshness);

    objects.push({
      objectType: 'review',
      title,
      status,
      lifecycle_stage: lifecycle,
      producing_agent: producingAgent,
      source_path: field(rel, 'Derived'),
      related_initiative: related,
      review_need: reviewNeed,             // Candidate
      freshness,
      schema_family: field(family, 'Derived'),
      source_evidence: field({ file: rel, locator: 'whole file' }, 'Derived'),
    });
  }
  return { objects, errors };
}

function deriveTitle(f, rel) {
  const fm = f.frontmatter || {};
  if (fm.title) return field(fm.title, 'Canonical');           // content files
  const h1 = (f.content || '').split(/\r?\n/).find(l => /^#\s+/.test(l));
  if (h1) return field(h1.replace(/^#\s+/, '').trim(), 'Derived');
  return field(path.basename(rel), 'Derived');
}

function deriveRelatedInitiative(fm) {
  const refs = []
    .concat(Array.isArray(fm.linked_objects) ? fm.linked_objects : [])
    .concat(Array.isArray(fm.derived_from) ? fm.derived_from : []);
  const slug = refs.find(r => typeof r === 'string' && /initiative|command-center|website|risk-brief/i.test(r));
  return slug ? field(slug, 'Derived') : nys('Derived');
}

function deriveReviewNeed(fm, freshness) {
  const s = fm.status ? String(fm.status).toLowerCase() : null;
  if (s && ['draft', 'staged', 'pending'].includes(s)) return field({ need: 'review pending', basis: `status: ${s}`, confidence: 'medium' }, 'Candidate');
  if (freshness && !freshness.nys && freshness.value.state === 'stale') return field({ need: 'review pending', basis: 'stale past §3 threshold', confidence: 'medium' }, 'Candidate');
  if (!s) return nys('Candidate');
  return field({ need: 'none', basis: `status: ${s}`, confidence: 'low' }, 'Candidate');
}

// ---------------------------------------------------------------------------
// §7 — Learning Signal (FR15). Candidate-only; SUPPRESSED entirely when no
// traceable repo-artifact source resolves (no orphan signals). A signal is
// surfaced only when an artifact explicitly records one via a `learning_signal:`
// frontmatter field or a "## Learning Signal(s)" / "## Lessons" body section.
// Confidence never defaults to high.
// ---------------------------------------------------------------------------
function adaptLearningSignals(repoRoot, thresholds, today) {
  const objects = [];
  const errors = [];
  let files = [];
  try { files = discoverGovernanceFiles(repoRoot); } catch (err) { errors.push({ path: 'agents/', error: String(err.message || err) }); }

  for (const abs of files) {
    const f = parseFile(abs);
    if (f.error) continue;
    const rel = f.path;
    const fm = f.frontmatter || {};

    // Source 1: explicit frontmatter field.
    if (fm.learning_signal) {
      objects.push(signalObject(fm.learning_signal, rel, 'frontmatter.learning_signal'));
      continue;
    }
    // Source 2: explicit body section.
    const sec = extractSection(f.content || '', /^##\s+(Learning Signals?|Lessons(?: Learned)?)\b/i);
    if (sec) {
      objects.push(signalObject(sec.text, rel, `section "${sec.heading}"`));
    }
    // No marker → no object (suppressed; no orphan).
  }
  return { objects, errors };
}

function signalObject(signalText, rel, locator) {
  const text = String(signalText).replace(/\s+/g, ' ').trim().slice(0, 300);
  return {
    objectType: 'learning_signal',
    signal: field(text, 'Candidate'),               // never rendered as fact
    confidence: field('low', 'Candidate'),          // never defaults to high (FR15)
    source_artifact: field(rel, 'Derived'),         // real pointer prevents orphaning
    source_evidence: field({ file: rel, locator }, 'Derived'),
  };
}

function extractSection(content, headingRe) {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(headingRe);
    if (m) {
      const body = [];
      for (let j = i + 1; j < lines.length && !/^##\s/.test(lines[j]); j++) body.push(lines[j]);
      return { heading: m[1], text: body.join(' ').trim() };
    }
  }
  return null;
}

function walkFind(dir, basename, acc) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name === 'runs') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFind(p, basename, acc);
    else if (e.isFile() && e.name === basename && !acc.includes(p)) acc.push(p);
  }
}

module.exports = { adaptMilestones, adaptReviews, adaptLearningSignals };
