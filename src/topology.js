'use strict';
// Brief B — Topology Map + Roadmap Spine. Read-only.
// Topology edges follow Gate C Amendment 1 (2026-06-13): an edge read directly
// from a Phase 0b definition-file frontmatter field is Canonical; an edge present
// only in prose is Derived; an unresolved edge renders not-yet-structured.
// Gate C six-object mappings are untouched here.

const fs = require('fs');
const path = require('path');
const { REPO_ROOT, parseFile, field, nys, slugify, findTable } = require('./parse');

// D32: node kinds and edge types a promoted manifest may declare. The manifest
// is an ADDITIONAL adapter family — Gate C parsing of the six Stakeport object
// families is untouched.
const MANIFEST_NODE_KINDS = new Set(['agent', 'skill', 'workflow', 'document', 'code-surface', 'memory']);
const MANIFEST_EDGE_TYPES = new Set(['owns', 'reports-to', 'depends-on', 'dispatches-to', 'consumes-from', 'reads', 'produces']);
const MANIFEST_SCHEMA = 'dreamfeed-topology/v1';

// ---------------------------------------------------------------------------
// Definition-file discovery (Phase 0b): AGENT.md at agents/<agent>/AGENT.md and
// SKILL.md at agents/<agent>/skills/<skill>/SKILL.md. Read by name, NOT via the
// governance discovery sweep (they live outside agents/*/outputs/).
// ---------------------------------------------------------------------------
function discoverDefinitionFiles(repoRoot = REPO_ROOT) {
  const out = [];
  const agentsDir = path.join(repoRoot, 'agents');
  let agents = [];
  try { agents = fs.readdirSync(agentsDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); }
  catch { return out; }
  for (const a of agents) {
    const agentMd = path.join(agentsDir, a, 'AGENT.md');
    if (fs.existsSync(agentMd)) out.push({ kind: 'agent', file: agentMd });
    const skillsDir = path.join(agentsDir, a, 'skills');
    let skills = [];
    try { skills = fs.readdirSync(skillsDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch { skills = []; }
    for (const s of skills) {
      const skillMd = path.join(skillsDir, s, 'SKILL.md');
      if (fs.existsSync(skillMd)) out.push({ kind: 'skill', file: skillMd });
    }
  }
  return out;
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v === undefined || v === null || v === '') return [];
  return [v];
}

function buildTopology(repoRoot = REPO_ROOT) {
  const nodes = [];
  const edges = [];
  const errors = [];
  const repoInventory = [];

  const defFiles = discoverDefinitionFiles(repoRoot);
  for (const d of defFiles) {
    const f = parseFile(d.file, repoRoot);
    const rel = f.path;
    // Canonical Repo Inventory: path-derived node (read directly from the filesystem path).
    repoInventory.push({
      path: field(rel, 'Canonical'),
      kind: field(d.kind, 'Canonical'),
      hasDefinitionFrontmatter: field(!!(f.frontmatter && f.frontmatter.definition_type), 'Derived'),
    });
    if (f.error) { errors.push({ path: rel, error: f.error }); continue; }

    const fm = f.frontmatter;
    const hasFm = fm && fm.definition_type;

    if (d.kind === 'agent') {
      const id = hasFm && fm.agent_id ? fm.agent_id : slugify(path.basename(path.dirname(d.file)));
      nodes.push({
        nodeType: 'agent',
        id: field(id, hasFm ? 'Canonical' : 'Derived'),
        name: hasFm && fm.agent_name ? field(fm.agent_name, 'Canonical') : nys('Canonical'),
        layer: hasFm && fm.layer ? field(fm.layer, 'Canonical') : nys('Canonical'),
        status: hasFm && fm.status ? field(fm.status, 'Canonical') : nys('Canonical'),
        source_evidence: field({ file: rel, locator: 'frontmatter' }, 'Derived'),
        frontmatterPresent: hasFm ? true : false,
      });
      if (!hasFm) {
        // Degrade: no Phase 0b frontmatter → edges not-yet-structured (no prose-scan in Phase 0b build).
        edges.push(degradedEdge(id, rel, 'agent edges'));
        continue;
      }
      // Canonical agent edges (Gate C Amendment 1).
      for (const s of asArray(fm.skills)) edges.push(canonEdge(id, s, 'owns', rel, 'skills'));
      if (fm.reports_to) edges.push(canonEdge(id, fm.reports_to, 'reports-to', rel, 'reports_to'));
      for (const a of asArray(fm.dispatches_to)) edges.push(canonEdge(id, a, 'dispatches-to', rel, 'dispatches_to'));
      for (const a of asArray(fm.consumes_from)) edges.push(canonEdge(id, a, 'consumes-from', rel, 'consumes_from'));
      for (const p of asArray(fm.reads)) edges.push(canonEdge(id, p, 'reads', rel, 'reads'));
    } else {
      const id = hasFm && fm.skill_id ? fm.skill_id : slugify(path.basename(path.dirname(d.file)));
      nodes.push({
        nodeType: 'skill',
        id: field(id, hasFm ? 'Canonical' : 'Derived'),
        name: hasFm && fm.skill_name ? field(fm.skill_name, 'Canonical') : nys('Canonical'),
        owning_agent: hasFm && fm.owning_agent ? field(fm.owning_agent, 'Canonical') : nys('Canonical'),
        status: hasFm && fm.status ? field(fm.status, 'Canonical') : nys('Canonical'),
        source_evidence: field({ file: rel, locator: 'frontmatter' }, 'Derived'),
        frontmatterPresent: hasFm ? true : false,
      });
      if (!hasFm) { edges.push(degradedEdge(id, rel, 'skill edges')); continue; }
      if (fm.owning_agent) edges.push(canonEdge(fm.owning_agent, id, 'owns', rel, 'owning_agent'));
      for (const p of asArray(fm.produces)) edges.push(canonEdge(id, p, 'produces', rel, 'produces'));
      for (const dep of asArray(fm.depends_on)) edges.push(canonEdge(id, dep, 'depends-on', rel, 'depends_on'));
    }
  }

  // D32: merge the promoted os/topology.md manifest. Promoted objects are
  // Canonical — the manifest is git-versioned project truth written through
  // the governed lifecycle (founder-confirmed tier call, D32).
  const manifest = readManifest(repoRoot);
  for (const n of manifest.nodes) nodes.push(n);
  for (const e of manifest.edges) edges.push(e);
  for (const err of manifest.errors) errors.push(err);
  if (manifest.present) {
    repoInventory.push({
      path: field('os/topology.md', 'Canonical'),
      kind: field('topology-manifest', 'Canonical'),
      hasDefinitionFrontmatter: field(manifest.hasFrontmatter, 'Derived'),
    });
  }

  // Edge-tier tally (for the UI legend / self-verification).
  const tally = { Canonical: 0, Derived: 0, nys: 0 };
  for (const e of edges) {
    if (e.tier.nys) tally.nys++;
    else if (e.tier.value === 'Canonical') tally.Canonical++;
    else tally.Derived++;
  }

  return { nodes, edges, repoInventory, errors, tally };
}

// D32: read the promoted topology manifest (os/topology.md). Table-based —
// the flat-YAML frontmatter subset cannot express node/edge lists, and the
// table parser (findTable) is already the policy-file precedent.
function readManifest(repoRoot = REPO_ROOT) {
  const out = { present: false, hasFrontmatter: false, nodes: [], edges: [], errors: [] };
  const rel = 'os/topology.md';
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) return out;
  out.present = true;
  const f = parseFile(abs, repoRoot);
  if (f.error) { out.errors.push({ path: rel, error: f.error }); return out; }
  out.hasFrontmatter = !!(f.frontmatter && f.frontmatter.schema);
  if (!f.frontmatter || f.frontmatter.schema !== MANIFEST_SCHEMA) {
    out.errors.push({ path: rel, error: `invalid topology manifest schema: expected ${MANIFEST_SCHEMA}` });
    return out;
  }
  const nodesTable = findTable(f.content, ['Id', 'Kind']);
  if (nodesTable) {
    nodesTable.rows.forEach((row, i) => {
      const [id, kind, name, promotedFrom, matchedBy] = row.cells.map((c) => (c || '').trim());
      if (!id) return;
      if (!MANIFEST_NODE_KINDS.has(kind)) { out.errors.push({ path: rel, error: `nodes table row ${i + 1}: unknown kind "${kind}"` }); return; }
      out.nodes.push({
        nodeType: kind,
        id: field(id, 'Canonical'),
        name: field(name || id, 'Canonical'),
        status: field('promoted', 'Canonical'),
        promoted_from: promotedFrom && promotedFrom !== '—' ? field(promotedFrom, 'Canonical') : nys('Canonical'),
        matched_by: matchedBy && matchedBy !== '—' ? field(matchedBy, 'Canonical') : nys('Canonical'),
        source_evidence: field({ file: rel, locator: `nodes table row ${i + 1}` }, 'Derived'),
        frontmatterPresent: true,
      });
    });
  }
  const edgesTable = findTable(f.content, ['From', 'Type', 'To']);
  if (edgesTable) {
    edgesTable.rows.forEach((row, i) => {
      const [from, type, to] = row.cells.map((c) => (c || '').trim());
      if (!from || !to) return;
      if (!MANIFEST_EDGE_TYPES.has(type)) { out.errors.push({ path: rel, error: `edges table row ${i + 1}: unknown type "${type}"` }); return; }
      out.edges.push({
        from: field(from, 'Canonical'), to: field(to, 'Canonical'), type: field(type, 'Canonical'),
        tier: field('Canonical', 'Canonical'),
        source_evidence: field({ file: rel, locator: `edges table row ${i + 1}` }, 'Derived'),
      });
    });
  }
  return out;
}

function canonEdge(from, to, type, file, fmField) {
  return {
    from: field(from, 'Canonical'),
    to: field(to, 'Canonical'),
    type: field(type, 'Canonical'),
    tier: field('Canonical', 'Canonical'),
    source_evidence: field({ file, locator: `frontmatter.${fmField}` }, 'Derived'),
  };
}

function degradedEdge(from, file, note) {
  return {
    from: field(from, 'Derived'),
    to: nys('Derived'),
    type: nys('Derived'),
    tier: nys('Derived'),
    note: field(`no Phase 0b frontmatter on ${file} — ${note} not yet structured`, 'Derived'),
    source_evidence: field({ file, locator: '(no definition frontmatter)' }, 'Derived'),
  };
}

// ---------------------------------------------------------------------------
// Roadmap Spine (FR12/FR13): Phase 1 / 1.5 / 2 / 3 nodes from CLAUDE.md "Phase
// sequencing" prose. Derived label + scope; Candidate timing. Roadmap phase
// terms (Phase 1|1.5|2|3) are kept distinct from build-maturity terms
// (crawl|walk|run) — never conflated.
// ---------------------------------------------------------------------------
function buildRoadmap(repoRoot = REPO_ROOT) {
  const objects = [];
  const errors = [];
  const claudePath = path.join(repoRoot, 'CLAUDE.md');
  let content;
  try { content = fs.readFileSync(claudePath, 'utf8'); }
  catch (err) { return { objects, errors: [{ path: 'CLAUDE.md', error: String(err.message || err) }] }; }

  const lines = content.split(/\r?\n/);
  // Find the "## Phase sequencing" section.
  let i = lines.findIndex(l => /^##\s+Phase sequencing/i.test(l));
  if (i === -1) return { objects, errors: [{ path: 'CLAUDE.md', error: 'Phase sequencing section not found' }] };
  for (i = i + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break; // next section
    const m = lines[i].match(/^-\s+\*?\*?Phase\s+([0-9.]+)\b([^:]*):\s*(.*)$/i);
    if (!m) continue;
    const phase = `Phase ${m[1]}`;
    const timingRaw = (m[2] || '').replace(/[()]/g, '').trim(); // e.g. "now", "month ~9"
    const scope = m[3].trim();
    objects.push({
      objectType: 'roadmap_phase',
      phase_label: field(phase, 'Derived'),       // roadmap term, never crawl|walk|run (FR13)
      scope_summary: field(scope.slice(0, 400), 'Derived'),
      target_timing: timingRaw ? field(timingRaw, 'Candidate') : nys('Candidate'),
      source_evidence: field({ file: 'CLAUDE.md', locator: `Phase sequencing line ${i + 1}` }, 'Derived'),
    });
  }
  if (!objects.length) errors.push({ path: 'CLAUDE.md', error: 'no Phase N bullets parsed under Phase sequencing' });
  return { objects, errors };
}

module.exports = { buildTopology, buildRoadmap, discoverDefinitionFiles, readManifest, MANIFEST_NODE_KINDS, MANIFEST_EDGE_TYPES, MANIFEST_SCHEMA };
