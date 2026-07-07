'use strict';
// Governed memory layer (D33). Memories are app-sidecar records, never source
// truth. Writes happen only when the lifecycle executor calls these functions.

const crypto = require('crypto');
const store = require('./commands/store');
const { rootToken } = require('./parse');

const MEMORY_KINDS = new Set(['semantic', 'episodic', 'procedural', 'preference']);
const MEMORY_STATES = new Set(['active', 'archived', 'deleted-tombstone']);
const MEMORY_SCOPES = new Set(['project', 'operator', 'product']);
const CONFIDENCE = new Set(['low', 'medium', 'high']);
const MAX_TITLE = 160;
const MAX_BODY = 5000;
const MAX_TAGS = 12;
const ASSISTANT_MEMORY_LIMIT = 6;
const ASSISTANT_CONTEXT_BODY_CAP = 4000;
const LIST_LIMIT = 50;
const KIND_ORDER = ['semantic', 'episodic', 'procedural', 'preference'];
const STATE_ORDER = ['active', 'archived', 'deleted-tombstone'];
const SCOPE_ORDER = ['project', 'operator', 'product'];
const SENSITIVE_CONTEXT = /\b(source|file|ledger|canonical|truth|decision|policy|approval|governance|conflict|record)\b/i;

const SECRET_PATTERNS = [
  /\bsk-proj-[A-Za-z0-9_-]{8,}/i,
  /\bsk-[A-Za-z0-9_-]{16,}/i,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}/i,
  /\bxox[baprs]-[A-Za-z0-9-]{16,}/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/i,
  /\b(?:api[_-]?key|token|password|secret)\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{12,}/i,
  /\bAuthorization\s*:\s*Bearer\s+[A-Za-z0-9_./+=-]{12,}/i,
];

function nowIso() { return new Date().toISOString(); }

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function cleanText(value, max) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function hasLikelySecret(payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  return SECRET_PATTERNS.some((re) => re.test(text));
}

function normalizeTags(tags) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(tags) ? tags : []) {
    const tag = cleanText(raw, 40).toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

function normalizeSource(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return { type: 'manual' };
  const out = {};
  for (const [key, value] of Object.entries(source)) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,30}$/.test(key)) continue;
    if (value == null) continue;
    out[key] = cleanText(value, 260);
  }
  return Object.keys(out).length ? out : { type: 'manual' };
}

function normalizeScope(scope, repoRoot) {
  const type = cleanText(scope && scope.type ? scope.type : 'project', 20).toLowerCase();
  if (!MEMORY_SCOPES.has(type)) return { error: `invalid memory scope "${type}"`, code: 'validation' };
  if (type !== 'project') return { scope: { type } };
  if (!repoRoot) return { error: 'project-scoped memory requires an active project', code: 'no-project' };
  const tok = rootToken(repoRoot);
  if (scope && scope.rootToken && scope.rootToken !== tok) {
    return { error: 'memory scope belongs to a different project', code: 'root-drift' };
  }
  return { scope: { type: 'project', rootToken: tok } };
}

function contentHashOf(memory) {
  return sha256({
    kind: memory.kind,
    scope: memory.scope,
    title: memory.title,
    body: memory.body,
    tags: memory.tags,
    source: memory.source,
    confidence: memory.confidence,
    expiresAt: memory.expiresAt || null,
  });
}

function draftMemory(payload = {}, { repoRoot } = {}) {
  if (hasLikelySecret(payload)) return { error: 'memory appears to contain a secret or credential', code: 'secret' };
  const kind = cleanText(payload.kind || 'semantic', 20).toLowerCase();
  if (!MEMORY_KINDS.has(kind)) return { error: `invalid memory kind "${kind}"`, code: 'validation' };
  const title = cleanText(payload.title, MAX_TITLE);
  const body = cleanText(payload.body, MAX_BODY);
  if (!title) return { error: 'memory title required', code: 'validation' };
  if (!body) return { error: 'memory body required', code: 'validation' };
  const scoped = normalizeScope(payload.scope, repoRoot);
  if (scoped.error) return scoped;
  const confidence = CONFIDENCE.has(cleanText(payload.confidence || 'medium', 20).toLowerCase())
    ? cleanText(payload.confidence || 'medium', 20).toLowerCase()
    : 'medium';
  const expiresAt = payload.expiresAt ? cleanText(payload.expiresAt, 40) : null;
  if (expiresAt && Number.isNaN(Date.parse(expiresAt))) return { error: 'expiresAt must be parseable as a date', code: 'validation' };
  const memory = {
    state: 'active',
    kind,
    scope: scoped.scope,
    title,
    body,
    tags: normalizeTags(payload.tags),
    source: normalizeSource(payload.source),
    confidence,
    expiresAt,
    version: 1,
  };
  memory.contentHash = contentHashOf(memory);
  return { memory };
}

function visibleInScope(memory, repoRoot, { includeGlobal = true } = {}) {
  if (!memory || !memory.scope || !MEMORY_SCOPES.has(memory.scope.type)) return false;
  if (memory.scope.type === 'project') return !!repoRoot && memory.scope.rootToken === rootToken(repoRoot);
  return includeGlobal;
}

function isExpired(memory, now = new Date()) {
  return !!(memory.expiresAt && Date.parse(memory.expiresAt) < now.getTime());
}

function clampLimit(value, fallback, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(0, Math.min(Math.floor(n), max));
}

function requireVisible(memoryId, repoRoot) {
  const memory = store.get('memories', memoryId);
  if (!memory) return { error: `memory not found: ${memoryId}`, code: 'not-found' };
  if (!visibleInScope(memory, repoRoot)) return { error: 'memory belongs to a different scope', code: 'root-drift' };
  return { memory };
}

function getVisibleMemory(memoryId, repoRoot) {
  return requireVisible(memoryId, repoRoot);
}

function applyMemoryUpsert({ memoryId, draft, actor = 'operator' } = {}, repoRoot) {
  const normalized = draftMemory(draft, { repoRoot });
  if (normalized.error) return normalized;
  const ts = nowIso();
  if (memoryId) {
    const current = requireVisible(memoryId, repoRoot);
    if (current.error) return current;
    if (current.memory.state === 'deleted-tombstone') return { error: 'deleted memory cannot be updated', code: 'state' };
    const memory = {
      ...current.memory,
      ...normalized.memory,
      state: current.memory.state,
      id: current.memory.id,
      createdAt: current.memory.createdAt,
      updatedAt: ts,
      approvedBy: actor,
      version: (current.memory.version || 1) + 1,
    };
    memory.contentHash = contentHashOf(memory);
    return { memory: store.put('memories', memory) };
  }
  const memory = {
    ...normalized.memory,
    createdAt: ts,
    updatedAt: ts,
    approvedBy: actor,
  };
  return { memory: store.create('memories', 'mem', memory) };
}

function applyMemoryArchive({ memoryId, actor = 'operator' } = {}, repoRoot) {
  const current = requireVisible(memoryId, repoRoot);
  if (current.error) return current;
  if (current.memory.state === 'deleted-tombstone') return { error: 'deleted memory cannot be archived', code: 'state' };
  const memory = {
    ...current.memory,
    state: 'archived',
    updatedAt: nowIso(),
    archivedBy: actor,
    version: (current.memory.version || 1) + 1,
  };
  return { memory: store.put('memories', memory) };
}

function applyMemoryDelete({ memoryId, actor = 'operator' } = {}, repoRoot) {
  const current = requireVisible(memoryId, repoRoot);
  if (current.error) return current;
  const memory = {
    id: current.memory.id,
    state: 'deleted-tombstone',
    kind: current.memory.kind,
    scope: current.memory.scope,
    title: '',
    body: '',
    tags: [],
    source: { type: 'deleted' },
    confidence: current.memory.confidence || 'medium',
    createdAt: current.memory.createdAt,
    updatedAt: nowIso(),
    approvedBy: current.memory.approvedBy,
    expiresAt: null,
    version: (current.memory.version || 1) + 1,
    contentHash: current.memory.contentHash,
    deletedBy: actor,
    deletedAt: nowIso(),
  };
  return { memory: store.put('memories', memory) };
}

function listMemories({ repoRoot, state, kind, scope, tag, includeDeleted = false, includeGlobal = true } = {}) {
  const normalizedTag = tag ? cleanText(tag, 40).toLowerCase() : '';
  return store.list('memories')
    .filter((m) => visibleInScope(m, repoRoot, { includeGlobal }))
    .filter((m) => includeDeleted || m.state !== 'deleted-tombstone')
    .filter((m) => !state || m.state === state)
    .filter((m) => !kind || m.kind === kind)
    .filter((m) => !scope || (m.scope && m.scope.type === scope))
    .filter((m) => !normalizedTag || (m.tags || []).includes(normalizedTag))
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

function retrievalForMemory(memory, tokens, now = new Date()) {
  const hay = {
    title: String(memory.title || '').toLowerCase(),
    body: String(memory.body || '').toLowerCase(),
    tags: (memory.tags || []).join(' ').toLowerCase(),
  };
  const matchedFields = new Set();
  const reasons = [];
  let keywordScore = 0;
  for (const tok of tokens) {
    if (!tok) continue;
    if (hay.tags.includes(tok)) { keywordScore += 6; matchedFields.add('tags'); reasons.push(`tag:${tok}`); }
    if (hay.title.includes(tok)) { keywordScore += 4; matchedFields.add('title'); reasons.push(`title:${tok}`); }
    if (hay.body.includes(tok)) { keywordScore += 2; matchedFields.add('body'); reasons.push(`body:${tok}`); }
  }
  let score = memory.scope && memory.scope.type === 'project' ? 4 : 2;
  reasons.push(memory.scope && memory.scope.type === 'project' ? 'scope:project' : `scope:${memory.scope?.type || 'unknown'}`);
  score += keywordScore;
  if (memory.kind) { score += KIND_ORDER.indexOf(memory.kind) >= 0 ? 1 : 0; reasons.push(`kind:${memory.kind}`); }
  if (memory.source && memory.source.type && memory.source.type !== 'manual') {
    score += 1;
    matchedFields.add('source');
    reasons.push(`source:${memory.source.type}`);
  }
  const ts = Date.parse(memory.updatedAt || memory.createdAt || '');
  if (!Number.isNaN(ts)) {
    const days = (now.getTime() - ts) / 86400000;
    if (days <= 7) { score += 2; reasons.push('recency:7d'); }
    else if (days <= 30) { score += 1; reasons.push('recency:30d'); }
  }
  if (memory.confidence === 'high') { score += 1; reasons.push('confidence:high'); }
  return { score, reasons: [...new Set(reasons)], matchedFields: Array.from(matchedFields).sort() };
}

function formatMemory(memory, body = memory.body) {
  const scope = memory.scope.type === 'project' ? 'project' : memory.scope.type;
  const source = memory.source && memory.source.ref ? ` source=${memory.source.ref}` : '';
  return `- ${memory.id} [${memory.kind}/${scope}/${memory.confidence}] ${memory.title}\n  ${body}${source}`;
}

function contextFromScored(scored, capChars = ASSISTANT_CONTEXT_BODY_CAP) {
  let sentChars = 0;
  let totalChars = 0;
  let truncated = false;
  const lines = [];
  for (const item of scored) {
    const body = String(item.memory.body || '');
    totalChars += body.length;
    const remaining = Math.max(0, capChars - sentChars);
    let bodyForContext = body;
    if (body.length > remaining) {
      bodyForContext = remaining > 0 ? body.slice(0, remaining) : '[body omitted by cap]';
      truncated = true;
    }
    sentChars += Math.min(body.length, remaining);
    lines.push(formatMemory(item.memory, bodyForContext || '[empty body]'));
  }
  const context = lines.length ? [
    '[Dreamfeed memory context - non-authoritative; source files and ledger win on conflict]',
    ...lines,
    truncated ? '[memory context truncated by D34 cap]' : '',
  ].filter(Boolean).join('\n') : '';
  return { context, totalChars, sentChars, capChars, truncated };
}

function retrieveMemories({
  repoRoot,
  query = '',
  kind,
  state = 'active',
  scope,
  tag,
  limit = ASSISTANT_MEMORY_LIMIT,
  includeDeleted = false,
  includeGlobal = true,
  capChars = ASSISTANT_CONTEXT_BODY_CAP,
} = {}) {
  const tokens = cleanText(query, 400).toLowerCase().split(/[^a-z0-9_-]+/).filter(Boolean);
  const scored = listMemories({ repoRoot, state, kind, scope, tag, includeDeleted, includeGlobal })
    .filter((m) => !isExpired(m))
    .map((memory) => ({ memory, retrieval: retrievalForMemory(memory, tokens), warnings: memoryWarnings(memory, query) }))
    .filter((x) => !tokens.length || x.retrieval.matchedFields.some((f) => f === 'tags' || f === 'title' || f === 'body'))
    .sort((a, b) => b.retrieval.score - a.retrieval.score || String(b.memory.updatedAt || '').localeCompare(String(a.memory.updatedAt || '')) || String(a.memory.id || '').localeCompare(String(b.memory.id || '')))
    .slice(0, clampLimit(limit, ASSISTANT_MEMORY_LIMIT, LIST_LIMIT));
  const used = scored.map((x) => x.memory);
  const contextInfo = contextFromScored(scored, capChars);
  return {
    strategy: 'structured-keyword',
    vectorReady: true,
    used,
    items: scored.map((x) => ({ ...x.memory, retrieval: x.retrieval, warnings: x.warnings })),
    context: contextInfo.context,
    contextMeta: {
      totalChars: contextInfo.totalChars,
      sentChars: contextInfo.sentChars,
      capChars: contextInfo.capChars,
      truncated: contextInfo.truncated,
      maxMemories: clampLimit(limit, ASSISTANT_MEMORY_LIMIT, LIST_LIMIT),
    },
    citations: scored.map((x) => memoryCitation(x.memory)),
    contextWarnings: [...new Set(scored.flatMap((x) => x.warnings))],
  };
}

function exportSort(a, b) {
  const state = STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state);
  if (state) return state;
  const scope = SCOPE_ORDER.indexOf(a.scope?.type) - SCOPE_ORDER.indexOf(b.scope?.type);
  if (scope) return scope;
  const kind = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
  if (kind) return kind;
  const updated = String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
  if (updated) return updated;
  return String(a.id || '').localeCompare(String(b.id || ''));
}

function memoryCounts(memories) {
  const counts = { total: memories.length, active: 0, archived: 0, deletedTombstone: 0, project: 0, operator: 0, product: 0 };
  for (const memory of memories) {
    if (memory.state === 'active') counts.active += 1;
    else if (memory.state === 'archived') counts.archived += 1;
    else if (memory.state === 'deleted-tombstone') counts.deletedTombstone += 1;
    if (memory.scope && memory.scope.type && counts[memory.scope.type] != null) counts[memory.scope.type] += 1;
  }
  return counts;
}

function memoryWarnings(memory, query = '', now = new Date()) {
  const warnings = [];
  if (!memory) return warnings;
  if (memory.state && memory.state !== 'active') warnings.push(`state:${memory.state}; not eligible for assistant context`);
  if (memory.confidence === 'low') warnings.push('low confidence; verify before relying on this memory');
  const sourceType = memory.source && memory.source.type ? memory.source.type : 'manual';
  if (sourceType === 'manual') warnings.push('manual source; source files and ledger records still win');
  if (sourceType !== 'manual' && sourceType !== 'deleted' && !memory.source.ref) warnings.push(`source:${sourceType} missing ref`);
  if (isExpired(memory, now)) warnings.push('expired; should not be used for assistant context');
  const ts = Date.parse(memory.updatedAt || memory.createdAt || '');
  if (!Number.isNaN(ts) && ((now.getTime() - ts) / 86400000) > 90) warnings.push('stale:updated over 90 days ago');
  if (SENSITIVE_CONTEXT.test(String(query || ''))) warnings.push('source/ledger-sensitive prompt; cite sources or ledger on conflict');
  return [...new Set(warnings)];
}

function memoryCitation(memory) {
  return {
    id: memory.id,
    title: memory.title,
    kind: memory.kind,
    scope: memory.scope,
    state: memory.state,
    confidence: memory.confidence,
    source: memory.source,
    contentHash: memory.contentHash,
    version: memory.version,
  };
}

function exportMemories({ repoRoot, includeDeleted = false, includeArchived = true, includeGlobal = true } = {}) {
  const generatedAt = nowIso();
  const memories = listMemories({
    repoRoot,
    state: includeArchived ? undefined : 'active',
    includeDeleted,
    includeGlobal,
  }).sort(exportSort);
  return {
    schema: 'dreamfeed-memory-export/v1',
    exportVersion: 1,
    schemaVersion: store.SCHEMA_VERSION,
    exportedAt: generatedAt,
    generatedAt,
    project: repoRoot ? { scope: 'project', rootToken: rootToken(repoRoot) } : { scope: 'none', rootToken: null },
    counts: memoryCounts(memories),
    retrieval: { strategy: 'structured-keyword', vectorReady: true },
    memories,
  };
}

function safeMemorySummary(memory) {
  if (!memory) return null;
  return {
    id: memory.id,
    state: memory.state,
    kind: memory.kind,
    scope: memory.scope,
    title: memory.title,
    tags: memory.tags,
    confidence: memory.confidence,
    contentHash: memory.contentHash,
    version: memory.version,
  };
}

module.exports = {
  MEMORY_KINDS,
  MEMORY_STATES,
  MEMORY_SCOPES,
  ASSISTANT_MEMORY_LIMIT,
  ASSISTANT_CONTEXT_BODY_CAP,
  LIST_LIMIT,
  draftMemory,
  applyMemoryUpsert,
  applyMemoryArchive,
  applyMemoryDelete,
  listMemories,
  retrieveMemories,
  exportMemories,
  safeMemorySummary,
  memoryCounts,
  memoryWarnings,
  memoryCitation,
  getVisibleMemory,
};
