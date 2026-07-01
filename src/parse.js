'use strict';
// Read-only parsing core for the Dreamfeed Operational Core (Brief A).
// Implements contract §8 (schema-family detection), guide §1 (discovery),
// guide §4 (frontmatter block), and §10/guide §3 (freshness).
// This module NEVER writes: fs is used for reads only (NFR1).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APP_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = APP_ROOT; // backward-compat export alias

// ---------------------------------------------------------------------------
// Root identity (project switching). The canonical root is resolved through
// realpath (defeating symlink/junction aliasing) and case-normalized on Windows
// (case-insensitive FS) so two spellings of the same directory share one
// identity. `rootToken` is a short stable hash of that canonical form — every
// read endpoint stamps it so a stale-root request can be rejected rather than
// silently resolved against the wrong project.
// ---------------------------------------------------------------------------
function canonicalRoot(p) {
  let resolved = path.resolve(p);
  try { resolved = fs.realpathSync.native ? fs.realpathSync.native(resolved) : fs.realpathSync(resolved); }
  catch { /* path may not exist yet; fall back to the resolved (non-real) form */ }
  return resolved;
}
function canonicalKey(p) {
  // Identity key for equality/hashing only — never displayed.
  const c = canonicalRoot(p);
  return process.platform === 'win32' ? c.toLowerCase() : c;
}
function rootToken(p) {
  return crypto.createHash('sha1').update(canonicalKey(p)).digest('hex').slice(0, 12);
}

// ---------------------------------------------------------------------------
// Frontmatter (guide §4): YAML between the first and second `---` lines.
// Governance frontmatter uses a flat subset of YAML: scalar `key: value`,
// quoted strings, booleans, and string arrays as indented `- item` lines.
// ---------------------------------------------------------------------------
function extractFrontmatter(content) {
  const lines = content.split(/\r?\n/);
  if (!lines.length || lines[0].trim() !== '---' || lines[0] !== lines[0].trimStart()) return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { end = i; break; }
  }
  if (end === -1) return null;
  return { lines: lines.slice(1, end), bodyStartLine: end + 2 }; // 1-based body start
}

function unquote(v) {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function parseFrontmatterLines(fmLines) {
  const out = {};
  let currentArrayKey = null;
  for (const raw of fmLines) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const arrayItem = raw.match(/^\s+-\s+(.*)$/);
    if (arrayItem && currentArrayKey) {
      out[currentArrayKey].push(unquote(arrayItem[1]));
      continue;
    }
    const kv = raw.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2];
    if (val === '') {
      out[key] = [];
      currentArrayKey = key;
    } else {
      currentArrayKey = null;
      const u = unquote(val);
      out[key] = u === 'true' ? true : u === 'false' ? false : u;
    }
  }
  return out;
}

function parseFile(absPath, repoRoot = REPO_ROOT) {
  // Read-only file load with parse-error capture (never throws to caller).
  // `repoRoot` controls the base the source-evidence relative path is computed
  // against, so a switched project produces correct, in-repo provenance links.
  const rel = path.relative(repoRoot, absPath).split(path.sep).join('/');
  try {
    const content = fs.readFileSync(absPath, 'utf8');
    const fmBlock = extractFrontmatter(content);
    const frontmatter = fmBlock ? parseFrontmatterLines(fmBlock.lines) : null;
    return { path: rel, content, frontmatter, error: null };
  } catch (err) {
    return { path: rel, content: null, frontmatter: null, error: String(err.message || err) };
  }
}

// ---------------------------------------------------------------------------
// Schema-family detection (contract §8 / guide §5): exactly one family per file.
// ---------------------------------------------------------------------------
function detectSchemaFamily(frontmatter) {
  if (frontmatter && typeof frontmatter.governance_type === 'string') return 'governance';
  if (frontmatter && typeof frontmatter.content_type === 'string') return 'content';
  return 'untyped';
}

// ---------------------------------------------------------------------------
// File-discovery boundary (guide §1): .md under agents/<agent>/outputs/ at any
// depth, excluding product_spec.md and anything under a runs/ segment.
// ---------------------------------------------------------------------------
function discoverGovernanceFiles(repoRoot = REPO_ROOT) {
  const found = [];
  const agentsDir = path.join(repoRoot, 'agents');
  let agentNames = [];
  try { agentNames = fs.readdirSync(agentsDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); }
  catch { return found; }
  for (const agent of agentNames) {
    const outputs = path.join(agentsDir, agent, 'outputs');
    walk(outputs);
  }
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === 'runs') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith('.md') && e.name !== 'product_spec.md') found.push(p);
    }
  }
  return found.sort();
}

// ---------------------------------------------------------------------------
// Markdown body tables. Cells may contain escaped pipes (`\|`) — split on
// unescaped `|` only, then unescape.
// ---------------------------------------------------------------------------
function splitRow(line) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|').trim());
}

function isSeparatorRow(line) {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-');
}

// Returns every table in the body as { headers, rows: [{cells, line}] }.
function extractTables(content) {
  const lines = content.split(/\r?\n/);
  const tables = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim().startsWith('|') && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      const headers = splitRow(lines[i]);
      const rows = [];
      let j = i + 2;
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        rows.push({ cells: splitRow(lines[j]), line: j + 1 }); // 1-based line number
        j++;
      }
      tables.push({ headers, rows, headerLine: i + 1 });
      i = j;
    } else {
      i++;
    }
  }
  return tables;
}

// Find the first table whose headers include all the named columns (loose match).
function findTable(content, requiredHeaders) {
  const tables = extractTables(content);
  return tables.find(t =>
    requiredHeaders.every(h => t.headers.some(th => th.toLowerCase().includes(h.toLowerCase())))
  ) || null;
}

// ---------------------------------------------------------------------------
// Freshness (contract §10): thresholds are READ from the §3 table in
// shared/cockpit-integration-guide.md — the single source of truth, not inlined.
// ---------------------------------------------------------------------------
function loadStalenessThresholds(repoRoot = REPO_ROOT) {
  const guidePath = path.join(repoRoot, 'shared', 'cockpit-integration-guide.md');
  const content = fs.readFileSync(guidePath, 'utf8');
  const thresholds = {};
  // §3 table rows look like: | `strategic_initiatives` | 14 | rationale |
  const rowRe = /^\|\s*`([a-z_]+)`\s*\|\s*(\d+)\s*\|/gm;
  let m;
  while ((m = rowRe.exec(content)) !== null) {
    thresholds[m[1]] = parseInt(m[2], 10);
  }
  return thresholds;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function computeFreshness(frontmatter, thresholds, today = new Date()) {
  // Returns a Derived freshness field; degrades to not-yet-structured when
  // inputs are missing (untyped/content sources, absent dates, no §3 mapping).
  if (!frontmatter || typeof frontmatter.governance_type !== 'string') return nys('Derived');
  const ref = frontmatter.last_reviewed_date || frontmatter.date_modified;
  const threshold = thresholds[frontmatter.governance_type];
  if (!ref || !threshold) return nys('Derived');
  const refDate = new Date(ref + 'T00:00:00Z');
  if (isNaN(refDate.getTime())) return nys('Derived');
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const ageDays = Math.floor((todayUtc - refDate) / DAY_MS);
  let state = 'fresh';
  if (ageDays > threshold) state = 'stale';
  else if (ageDays >= threshold * 0.8) state = 'amber'; // within 20% of threshold (§3)
  return field({ state, ageDays, thresholdDays: threshold, referenceDate: ref }, 'Derived');
}

// ---------------------------------------------------------------------------
// Field wrappers: every rendered field carries exactly one provenance tier
// (contract §9). `nys` keeps the assigned tier while degrading the value.
// ---------------------------------------------------------------------------
function field(value, tier) { return { value, tier, nys: false }; }
function nys(tier) { return { value: null, tier, nys: true }; }

function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

module.exports = {
  REPO_ROOT,
  canonicalRoot,
  canonicalKey,
  rootToken,
  extractFrontmatter,
  parseFrontmatterLines,
  parseFile,
  detectSchemaFamily,
  discoverGovernanceFiles,
  splitRow,
  extractTables,
  findTable,
  loadStalenessThresholds,
  computeFreshness,
  field,
  nys,
  slugify,
};
