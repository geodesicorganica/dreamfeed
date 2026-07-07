'use strict';
// D32 — provider-agnostic deterministic discovery scanner (adoption bridge).
// Detects project structure by ROLE, not vendor naming, so any repo — not just
// Claude/Stakeport-shaped ones — yields a candidate map. Read-only: fs is used
// for reads only. Every candidate is explainable: provenance "discovered",
// a confidence tier, matchedBy evidence, and its sourcePath.
// No model-assisted discovery in v1 (docs/decisions/d32-human-rooted-topology.md).

const fs = require('fs');
const path = require('path');

const IGNORE = new Set(['.git', 'node_modules', 'dist', 'build', '.dreamfeed']);
const MAX_DEPTH = 6;
const MAX_ENTRIES = 8000;
const SNIFF_BYTES = 4096;
const MAX_PER_KIND = 40;

// Role-based signals. Directory names are matched per path segment; file names
// against the base name. All lowercase comparisons; deterministic order.
const AGENT_DIRS = new Set(['agents', 'agent', '.agents']);
const SKILL_DIRS = new Set(['skills', 'tools', 'prompts', 'playbooks']);
const MEMORY_DIRS = new Set(['memory', 'context', 'knowledge', 'notes']);
const CODE_DIRS = new Set(['src', 'app', 'server', 'public', 'scripts', 'packages', 'lib']);
const AGENT_NAMES = /(agent|assistant|operator|planner|reviewer|orchestrator)/;
const ROOT_DOCS = new Set(['agents.md', 'claude.md', 'readme.md', 'contributing.md', 'codex.md', '.windsurfrules', '.cursorrules']);
// Ecosystem-agnostic build/run entry points: task runners, CI configs, and
// the manifest each major ecosystem builds from. Matched at repo root only.
const WORKFLOW_FILES = new Set([
  'makefile', 'taskfile.yml', 'taskfile.yaml', 'justfile', 'rakefile',
  '.gitlab-ci.yml', 'azure-pipelines.yml', 'jenkinsfile',
  'pyproject.toml', 'requirements.txt', 'setup.py',
  'cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'build.gradle.kts',
  'gemfile', 'composer.json', 'dockerfile', 'docker-compose.yml', 'compose.yaml',
]);
const AGENTIC_FM_KEYS = ['agent_id', 'agent_name', 'skill_id', 'skill_name', 'owning_agent', 'owns', 'reports_to', 'dispatches_to', 'role', 'definition_type'];

function discover(repoRoot) {
  const out = { configured: true, candidates: [], rollups: [], stats: { entriesScanned: 0, truncated: false }, warnings: [], errors: [] };
  const root = path.resolve(repoRoot);
  let rootReal;
  try { rootReal = fs.realpathSync.native ? fs.realpathSync.native(root) : fs.realpathSync(root); }
  catch (err) { out.errors.push({ path: '.', error: String(err.message || err) }); return out; }

  const seen = new Set(); // candidate sourcePath dedupe
  const perKind = new Map();
  const rollupCounts = new Map(); // topLevelDir -> count of unmatched files

  const push = (kind, name, sourcePath, confidence, matchedBy) => {
    if (seen.has(`${kind}|${sourcePath}`)) return;
    seen.add(`${kind}|${sourcePath}`);
    const n = (perKind.get(kind) || 0) + 1;
    perKind.set(kind, n);
    if (n > MAX_PER_KIND) {
      if (n === MAX_PER_KIND + 1) out.warnings.push(`more than ${MAX_PER_KIND} ${kind} candidates — remainder rolled up, not dropped silently.`);
      rollupCounts.set(sourcePath.split('/')[0], (rollupCounts.get(sourcePath.split('/')[0]) || 0) + 1);
      return;
    }
    out.candidates.push({
      id: `discovered:${kind}:${sourcePath}`,
      kind, name,
      provenance: 'discovered',
      confidence,
      matchedBy,
      sourcePath,
    });
  };

  const sniffMarkdown = (abs, rel) => {
    // Deterministic, bounded metadata sniff: frontmatter keys, first heading.
    let text;
    try {
      const fd = fs.openSync(abs, 'r');
      const buf = Buffer.alloc(SNIFF_BYTES);
      const n = fs.readSync(fd, buf, 0, SNIFF_BYTES, 0);
      fs.closeSync(fd);
      text = buf.toString('utf8', 0, n);
    } catch { return; }
    const matched = [];
    if (text.startsWith('---')) {
      const end = text.indexOf('\n---', 3);
      const fm = end === -1 ? '' : text.slice(3, end);
      for (const key of AGENTIC_FM_KEYS) {
        if (new RegExp(`^\\s*${key}\\s*:`, 'm').test(fm)) matched.push(`frontmatter:${key}`);
      }
    }
    const heading = text.match(/^#\s+(.{1,120})$/m);
    if (heading && AGENT_NAMES.test(heading[1].toLowerCase())) matched.push(`heading:${heading[1].trim().slice(0, 60)}`);
    if (matched.length) {
      const kind = matched.some((m) => m.startsWith('frontmatter:skill')) ? 'skill' : 'agent';
      push(kind, path.basename(rel, '.md'), rel, 'medium', [`path:${rel}`].concat(matched));
    }
  };

  const walk = (dir, rel, depth) => {
    if (depth > MAX_DEPTH || out.stats.truncated) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)); }
    catch (err) { out.errors.push({ path: rel || '.', error: String(err.message || err) }); return; }
    for (const entry of entries) {
      if (out.stats.entriesScanned >= MAX_ENTRIES) {
        out.stats.truncated = true;
        out.warnings.push(`scan capped at ${MAX_ENTRIES} entries — deeper content is rolled up, not silently covered.`);
        return;
      }
      out.stats.entriesScanned++;
      const name = entry.name;
      const lower = name.toLowerCase();
      if (IGNORE.has(lower)) continue;
      const abs = path.join(dir, name);
      // Containment: never follow a link that escapes the chosen root.
      try {
        const real = fs.realpathSync.native ? fs.realpathSync.native(abs) : fs.realpathSync(abs);
        const realKey = process.platform === 'win32' ? real.toLowerCase() : real;
        const rootKey = process.platform === 'win32' ? rootReal.toLowerCase() : rootReal;
        if (realKey !== rootKey && !realKey.startsWith(rootKey + path.sep)) continue;
      } catch { continue; }
      const childRel = rel ? `${rel}/${name}` : name;
      const top = childRel.split('/')[0];
      if (entry.isDirectory()) {
        if (depth === 0 && CODE_DIRS.has(lower)) {
          push('code-surface', `${name}/`, childRel, 'high', [`path:${lower}`]);
          rollupCounts.set(top, rollupCounts.get(top) || 0); // surface exists; contents roll up
          walk(abs, childRel, depth + 1);
          continue;
        }
        if (AGENT_DIRS.has(lower) || (lower === 'agents' && rel.startsWith('ai'))) {
          let kids = [];
          try { kids = fs.readdirSync(abs, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort(); } catch { kids = []; }
          for (const kid of kids) push('agent', kid, `${childRel}/${kid}`, 'high', [`path:${lower}`]);
          if (!kids.length) push('agent', `${name}/`, childRel, 'medium', [`path:${lower}`]);
          walk(abs, childRel, depth + 1);
          continue;
        }
        if (SKILL_DIRS.has(lower)) {
          let kids = [];
          try { kids = fs.readdirSync(abs, { withFileTypes: true }).map((d) => d.name).sort(); } catch { kids = []; }
          for (const kid of kids) push('skill', kid.replace(/\.[^.]+$/, ''), `${childRel}/${kid}`, 'high', [`path:${lower}`]);
          continue;
        }
        if (MEMORY_DIRS.has(lower)) { push('memory', `${name}/`, childRel, 'medium', [`path:${lower}`]); continue; }
        if (childRel === '.github/workflows') {
          let kids = [];
          try { kids = fs.readdirSync(abs).sort(); } catch { kids = []; }
          for (const kid of kids) push('workflow', kid, `${childRel}/${kid}`, 'high', ['path:.github/workflows']);
          continue;
        }
        walk(abs, childRel, depth + 1);
        continue;
      }
      // Files.
      if (depth === 0 && ROOT_DOCS.has(lower)) { push('document', name, childRel, 'high', ['path:root-doc']); continue; }
      if (depth === 0 && WORKFLOW_FILES.has(lower)) { push('workflow', name, childRel, 'high', ['path:task-runner']); continue; }
      if (depth === 0 && lower === 'package.json') {
        try {
          const pkg = JSON.parse(fs.readFileSync(abs, 'utf8'));
          const scripts = Object.keys(pkg.scripts || {}).sort();
          if (scripts.length) push('workflow', `package scripts (${scripts.length})`, childRel, 'high', ['path:package.json'].concat(scripts.slice(0, 8).map((s) => `script:${s}`)));
        } catch { /* unparsable package.json is just a file */ }
        continue;
      }
      if (top === 'docs' && lower.endsWith('.md')) { push('document', childRel.slice(5), childRel, 'high', ['path:docs']); continue; }
      if (childRel.startsWith('.cursor/') || lower === '.cursorrules') { push('document', name, childRel, 'high', ['path:assistant-rules']); continue; }
      if (lower.endsWith('.md')) { sniffMarkdown(abs, childRel); if (seen.has(`agent|${childRel}`) || seen.has(`skill|${childRel}`)) continue; }
      if (AGENT_NAMES.test(lower.replace(/\.[^.]+$/, ''))) { push('agent', name, childRel, 'medium', ['name:agentic-filename']); continue; }
      // Unmatched: roll up by top-level directory — never per-file node spam.
      rollupCounts.set(top, (rollupCounts.get(top) || 0) + 1);
    }
  };
  walk(rootReal, '', 0);

  out.rollups = [...rollupCounts.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dir, count]) => ({
      id: `unmapped:${dir}`,
      kind: 'unmapped',
      name: `${dir} · ${count} unmapped file${count === 1 ? '' : 's'}`,
      provenance: 'unmapped',
      count,
      sourcePath: dir,
    }));
  return out;
}

module.exports = { discover, IGNORE, MAX_DEPTH, MAX_ENTRIES, SNIFF_BYTES };
