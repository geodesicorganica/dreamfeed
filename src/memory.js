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
const CONTEXT_CAP = 3200;

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

function listMemories({ repoRoot, state, kind, includeDeleted = false, includeGlobal = true } = {}) {
  return store.list('memories')
    .filter((m) => visibleInScope(m, repoRoot, { includeGlobal }))
    .filter((m) => includeDeleted || m.state !== 'deleted-tombstone')
    .filter((m) => !state || m.state === state)
    .filter((m) => !kind || m.kind === kind)
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

function tokenHits(memory, tokens) {
  const hay = {
    title: String(memory.title || '').toLowerCase(),
    body: String(memory.body || '').toLowerCase(),
    tags: (memory.tags || []).join(' ').toLowerCase(),
  };
  let score = 0;
  for (const tok of tokens) {
    if (!tok) continue;
    if (hay.tags.includes(tok)) score += 6;
    if (hay.title.includes(tok)) score += 4;
    if (hay.body.includes(tok)) score += 2;
  }
  return score;
}

function scoreMemory(memory, tokens, now = new Date()) {
  let score = memory.scope && memory.scope.type === 'project' ? 3 : 1;
  score += tokenHits(memory, tokens);
  if (memory.source && memory.source.type && memory.source.type !== 'manual') score += 1;
  const ts = Date.parse(memory.updatedAt || memory.createdAt || '');
  if (!Number.isNaN(ts)) {
    const days = (now.getTime() - ts) / 86400000;
    if (days <= 7) score += 2;
    else if (days <= 30) score += 1;
  }
  if (memory.confidence === 'high') score += 1;
  return score;
}

function formatMemory(memory) {
  const scope = memory.scope.type === 'project' ? 'project' : memory.scope.type;
  const source = memory.source && memory.source.ref ? ` source=${memory.source.ref}` : '';
  return `- ${memory.id} [${memory.kind}/${scope}/${memory.confidence}] ${memory.title}\n  ${memory.body}${source}`;
}

function retrieveMemories({ repoRoot, query = '', kind, limit = 5, includeGlobal = true } = {}) {
  const tokens = cleanText(query, 400).toLowerCase().split(/[^a-z0-9_-]+/).filter(Boolean);
  const scored = listMemories({ repoRoot, state: 'active', kind, includeGlobal })
    .filter((m) => !isExpired(m))
    .filter((m) => !tokens.length || tokenHits(m, tokens) > 0)
    .map((memory) => ({ memory, score: scoreMemory(memory, tokens) }))
    .sort((a, b) => b.score - a.score || String(b.memory.updatedAt || '').localeCompare(String(a.memory.updatedAt || '')))
    .slice(0, Math.max(0, Math.min(Number(limit) || 5, 12)));
  const used = scored.map((x) => x.memory);
  let context = '';
  if (used.length) {
    context = [
      '[Dreamfeed memory context - non-authoritative; source files and ledger win on conflict]',
      ...used.map(formatMemory),
    ].join('\n');
    if (context.length > CONTEXT_CAP) context = context.slice(0, CONTEXT_CAP) + '\n[truncated]';
  }
  return {
    strategy: 'structured-keyword',
    vectorReady: true,
    used,
    context,
  };
}

function exportMemories({ repoRoot, includeDeleted = false, includeGlobal = true } = {}) {
  return {
    schema: 'dreamfeed-memory-export/v1',
    schemaVersion: 1,
    exportedAt: nowIso(),
    retrieval: { strategy: 'structured-keyword', vectorReady: true },
    memories: listMemories({ repoRoot, includeDeleted, includeGlobal }),
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
  draftMemory,
  applyMemoryUpsert,
  applyMemoryArchive,
  applyMemoryDelete,
  listMemories,
  retrieveMemories,
  exportMemories,
  safeMemorySummary,
  getVisibleMemory,
};
