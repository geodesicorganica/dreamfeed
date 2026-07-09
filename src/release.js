'use strict';
// D35 verification/release cockpit records. These are app-sidecar evidence
// records, not source truth. Writes happen only through the governed lifecycle.

const crypto = require('crypto');
const store = require('./commands/store');
const { rootToken } = require('./parse');

const VERIFICATION_STATES = new Set(['recorded', 'superseded']);
const RELEASE_STATES = new Set(['candidate', 'ready', 'shipped', 'abandoned']);
const CHECK_STATUSES = new Set(['pass', 'fail', 'warn', 'unknown', 'never-run']);
const MAX_TITLE = 180;
const MAX_SUMMARY = 5000;
const MAX_NOTE = 2000;
const MAX_CHECKS = 30;
const MAX_REFS = 80;

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
function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex'); }
function cleanText(value, max) { return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max); }
function cleanId(value) { return cleanText(value, 120).replace(/[^A-Za-z0-9_.:-]/g, ''); }

function hasLikelySecret(payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  return SECRET_PATTERNS.some((re) => re.test(text));
}

function normalizeScope(scope, repoRoot, label) {
  if (!repoRoot) return { error: `${label} requires an active project`, code: 'no-project' };
  const tok = rootToken(repoRoot);
  const type = cleanText(scope && scope.type ? scope.type : 'project', 20).toLowerCase();
  if (type !== 'project') return { error: `${label} scope must be project`, code: 'validation' };
  if (scope && scope.rootToken && scope.rootToken !== tok) return { error: `${label} scope belongs to a different project`, code: 'root-drift' };
  return { scope: { type: 'project', rootToken: tok } };
}

function normalizeSource(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return { type: 'manual' };
  const type = cleanText(source.type || 'manual', 40).toLowerCase() || 'manual';
  const out = { type };
  if (source.ref) out.ref = cleanText(source.ref, 260);
  if (source.label) out.label = cleanText(source.label, 180);
  return out;
}

function normalizeChecks(checks) {
  const out = [];
  for (const check of Array.isArray(checks) ? checks : []) {
    if (!check || typeof check !== 'object') continue;
    const label = cleanText(check.label || check.name, 160);
    if (!label) continue;
    const status = CHECK_STATUSES.has(cleanText(check.status || 'unknown', 40)) ? cleanText(check.status || 'unknown', 40) : 'unknown';
    out.push({
      label,
      status,
      command: check.command ? cleanText(check.command, 260) : null,
      source: check.source ? cleanText(check.source, 180) : null,
      ranAt: check.ranAt ? cleanText(check.ranAt, 80) : null,
      currency: check.currency ? cleanText(check.currency, 80) : null,
      details: check.details ? cleanText(check.details, MAX_NOTE) : null,
    });
    if (out.length >= MAX_CHECKS) break;
  }
  return out;
}

function normalizeRefs(refs) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(refs) ? refs : []) {
    const id = cleanId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_REFS) break;
  }
  return out;
}

function normalizeLedgerRange(range) {
  const fromSeq = Number(range && range.fromSeq);
  const toSeq = Number(range && range.toSeq);
  return {
    fromSeq: Number.isInteger(fromSeq) && fromSeq > 0 ? fromSeq : null,
    toSeq: Number.isInteger(toSeq) && toSeq > 0 ? toSeq : null,
    chainHash: range && range.chainHash ? cleanText(range.chainHash, 80) : null,
  };
}

function normalizeCounts(counts) {
  const c = counts && typeof counts === 'object' ? counts : {};
  return {
    staged: Number.isInteger(c.staged) ? c.staged : 0,
    unstaged: Number.isInteger(c.unstaged) ? c.unstaged : 0,
    untracked: Number.isInteger(c.untracked) ? c.untracked : 0,
  };
}

function normalizeGitSnapshot(snapshot) {
  const s = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const upstream = s.upstream && typeof s.upstream === 'object' ? s.upstream : {};
  const lastCommit = s.lastCommit && typeof s.lastCommit === 'object' ? s.lastCommit : {};
  return {
    branch: s.branch ? cleanText(s.branch, 120) : null,
    clean: typeof s.clean === 'boolean' ? s.clean : null,
    counts: normalizeCounts(s.counts),
    upstream: {
      exists: !!upstream.exists,
      ahead: Number.isInteger(upstream.ahead) ? upstream.ahead : null,
      behind: Number.isInteger(upstream.behind) ? upstream.behind : null,
      name: upstream.name ? cleanText(upstream.name, 160) : null,
    },
    lastCommit: {
      hash: lastCommit.hash ? cleanText(lastCommit.hash, 80) : null,
      subject: lastCommit.subject ? cleanText(lastCommit.subject, 240) : null,
      date: lastCommit.date ? cleanText(lastCommit.date, 80) : null,
    },
    inspectedAt: s.inspectedAt ? cleanText(s.inspectedAt, 80) : null,
  };
}

function verificationHashOf(record) {
  return sha256({
    state: record.state,
    scope: record.scope,
    title: record.title,
    summary: record.summary,
    checks: record.checks,
    gitSnapshot: record.gitSnapshot,
    ledgerRange: record.ledgerRange,
    lifecycleRefs: record.lifecycleRefs,
    source: record.source,
  });
}

function releaseHashOf(record) {
  return sha256({
    state: record.state,
    scope: record.scope,
    title: record.title,
    versionLabel: record.versionLabel,
    summary: record.summary,
    verificationRecordIds: record.verificationRecordIds,
    includedPlanIds: record.includedPlanIds,
    includedExecutionIds: record.includedExecutionIds,
    ledgerRange: record.ledgerRange,
    gitSnapshot: record.gitSnapshot,
    riskNotes: record.riskNotes,
  });
}

function draftVerificationRecord(payload = {}, { repoRoot } = {}) {
  if (hasLikelySecret(payload)) return { error: 'verification record appears to contain a secret or credential', code: 'secret' };
  const scoped = normalizeScope(payload.scope, repoRoot, 'verification record');
  if (scoped.error) return scoped;
  const title = cleanText(payload.title, MAX_TITLE);
  const summary = cleanText(payload.summary, MAX_SUMMARY);
  if (!title) return { error: 'verification title required', code: 'validation' };
  if (!summary) return { error: 'verification summary required', code: 'validation' };
  const checks = normalizeChecks(payload.checks);
  if (!checks.length) return { error: 'verification requires at least one check', code: 'validation' };
  const record = {
    state: 'recorded',
    scope: scoped.scope,
    title,
    summary,
    checks,
    gitSnapshot: normalizeGitSnapshot(payload.gitSnapshot),
    ledgerRange: normalizeLedgerRange(payload.ledgerRange),
    lifecycleRefs: normalizeRefs(payload.lifecycleRefs),
    source: normalizeSource(payload.source),
    version: 1,
  };
  record.contentHash = verificationHashOf(record);
  return { record };
}

function visibleInScope(record, repoRoot) {
  return !!(record && record.scope && record.scope.type === 'project' && repoRoot && record.scope.rootToken === rootToken(repoRoot));
}

function requireVisibleVerification(id, repoRoot) {
  const record = store.get('verificationRecords', id);
  if (!record) return { error: `verification record not found: ${id}`, code: 'not-found' };
  if (!visibleInScope(record, repoRoot)) return { error: 'verification record belongs to a different scope', code: 'root-drift' };
  return { record };
}

function requireVisibleRelease(id, repoRoot) {
  const release = store.get('releaseCandidates', id);
  if (!release) return { error: `release candidate not found: ${id}`, code: 'not-found' };
  if (!visibleInScope(release, repoRoot)) return { error: 'release candidate belongs to a different scope', code: 'root-drift' };
  return { release };
}

function applyVerificationRecordCreate({ draft, actor = 'operator' } = {}, repoRoot) {
  const normalized = draftVerificationRecord(draft, { repoRoot });
  if (normalized.error) return normalized;
  const ts = nowIso();
  const record = { ...normalized.record, createdAt: ts, updatedAt: ts, approvedBy: actor };
  return { record: store.create('verificationRecords', 'ver', record) };
}

function draftReleaseCandidate(payload = {}, { repoRoot } = {}) {
  if (hasLikelySecret(payload)) return { error: 'release candidate appears to contain a secret or credential', code: 'secret' };
  const scoped = normalizeScope(payload.scope, repoRoot, 'release candidate');
  if (scoped.error) return scoped;
  const title = cleanText(payload.title, MAX_TITLE);
  const versionLabel = cleanText(payload.versionLabel, 80);
  const summary = cleanText(payload.summary, MAX_SUMMARY);
  if (!title) return { error: 'release title required', code: 'validation' };
  if (!versionLabel) return { error: 'release versionLabel required', code: 'validation' };
  if (!summary) return { error: 'release summary required', code: 'validation' };
  const verificationRecordIds = normalizeRefs(payload.verificationRecordIds);
  if (!verificationRecordIds.length) return { error: 'release candidate requires at least one verification record', code: 'validation' };
  const release = {
    state: 'candidate',
    scope: scoped.scope,
    title,
    versionLabel,
    summary,
    verificationRecordIds,
    includedPlanIds: normalizeRefs(payload.includedPlanIds),
    includedExecutionIds: normalizeRefs(payload.includedExecutionIds),
    ledgerRange: normalizeLedgerRange(payload.ledgerRange),
    gitSnapshot: normalizeGitSnapshot(payload.gitSnapshot),
    riskNotes: cleanText(payload.riskNotes, MAX_SUMMARY),
    version: 1,
  };
  release.contentHash = releaseHashOf(release);
  return { release };
}

function validateVerificationRefs(ids, repoRoot) {
  for (const id of ids) {
    const found = requireVisibleVerification(id, repoRoot);
    if (found.error) return found;
  }
  return { ok: true };
}

function applyReleaseCandidateUpsert({ releaseId, draft, actor = 'operator' } = {}, repoRoot) {
  const normalized = draftReleaseCandidate(draft, { repoRoot });
  if (normalized.error) return normalized;
  const refs = validateVerificationRefs(normalized.release.verificationRecordIds, repoRoot);
  if (refs.error) return refs;
  const ts = nowIso();
  if (releaseId) {
    const current = requireVisibleRelease(releaseId, repoRoot);
    if (current.error) return current;
    if (current.release.state === 'shipped' || current.release.state === 'abandoned') {
      return { error: `release candidate is ${current.release.state} and cannot be updated`, code: 'state' };
    }
    const release = {
      ...current.release,
      ...normalized.release,
      state: current.release.state,
      id: current.release.id,
      createdAt: current.release.createdAt,
      updatedAt: ts,
      approvedBy: actor,
      version: (current.release.version || 1) + 1,
    };
    release.contentHash = releaseHashOf(release);
    return { release: store.put('releaseCandidates', release) };
  }
  const release = { ...normalized.release, createdAt: ts, updatedAt: ts, approvedBy: actor };
  return { release: store.create('releaseCandidates', 'rel', release) };
}

function applyReleaseState({ releaseId, state, actor = 'operator' } = {}, repoRoot) {
  if (!['ready', 'shipped', 'abandoned'].includes(state)) return { error: `invalid release state "${state}"`, code: 'validation' };
  const current = requireVisibleRelease(releaseId, repoRoot);
  if (current.error) return current;
  if (current.release.state === 'shipped' || current.release.state === 'abandoned') {
    return { error: `release candidate is already ${current.release.state}`, code: 'state' };
  }
  if (state === 'shipped' && current.release.state !== 'ready') return { error: 'release must be ready before it can be shipped', code: 'state' };
  const ts = nowIso();
  const release = {
    ...current.release,
    state,
    updatedAt: ts,
    approvedBy: actor,
    version: (current.release.version || 1) + 1,
  };
  if (state === 'shipped') release.shippedAt = ts;
  if (state === 'abandoned') release.abandonedAt = ts;
  release.contentHash = releaseHashOf(release);
  return { release: store.put('releaseCandidates', release) };
}

function deriveVerificationCurrency(record, { repoHealth, ledgerChain } = {}) {
  if (!record || record.state !== 'recorded') return 'stale';
  let known = false;
  if (ledgerChain && Number.isInteger(ledgerChain.length) && record.ledgerRange && Number.isInteger(record.ledgerRange.toSeq)) {
    known = true;
    if (ledgerChain.length > record.ledgerRange.toSeq) return 'stale';
  }
  if (repoHealth && !repoHealth.fatal) {
    known = true;
    const snap = record.gitSnapshot || {};
    if (snap.lastCommit && snap.lastCommit.hash && repoHealth.lastCommit && repoHealth.lastCommit.hash && snap.lastCommit.hash !== repoHealth.lastCommit.hash) return 'stale';
    if (typeof snap.clean === 'boolean' && typeof repoHealth.clean === 'boolean' && snap.clean !== repoHealth.clean) return 'stale';
    const counts = snap.counts || {};
    const nowCounts = repoHealth.counts || {};
    if (counts.staged !== nowCounts.staged || counts.unstaged !== nowCounts.unstaged || counts.untracked !== nowCounts.untracked) return 'stale';
  }
  return known ? 'current' : 'unknown';
}

function listVerificationRecords({ repoRoot, state, repoHealth, ledgerChain } = {}) {
  return store.list('verificationRecords')
    .filter((record) => visibleInScope(record, repoRoot))
    .filter((record) => !state || record.state === state)
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
    .map((record) => ({ ...record, currency: deriveVerificationCurrency(record, { repoHealth, ledgerChain }) }));
}

function listReleaseCandidates({ repoRoot, state } = {}) {
  return store.list('releaseCandidates')
    .filter((release) => visibleInScope(release, repoRoot))
    .filter((release) => !state || release.state === state)
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

function releaseCounts(records, releases) {
  const counts = { verificationRecords: records.length, currentVerification: 0, staleVerification: 0, candidates: 0, ready: 0, shipped: 0, abandoned: 0 };
  for (const record of records) {
    if (record.currency === 'current') counts.currentVerification += 1;
    if (record.currency === 'stale') counts.staleVerification += 1;
  }
  for (const release of releases) {
    if (release.state === 'candidate') counts.candidates += 1;
    if (release.state === 'ready') counts.ready += 1;
    if (release.state === 'shipped') counts.shipped += 1;
    if (release.state === 'abandoned') counts.abandoned += 1;
  }
  return counts;
}

function safeVerificationSummary(record) {
  if (!record) return null;
  return {
    id: record.id,
    state: record.state,
    title: record.title,
    scope: record.scope,
    checkCount: (record.checks || []).length,
    ledgerRange: record.ledgerRange,
    contentHash: record.contentHash,
    version: record.version,
  };
}

function safeReleaseSummary(release) {
  if (!release) return null;
  return {
    id: release.id,
    state: release.state,
    title: release.title,
    versionLabel: release.versionLabel,
    scope: release.scope,
    verificationRecordIds: release.verificationRecordIds || [],
    contentHash: release.contentHash,
    version: release.version,
  };
}

function exportReleaseEvidence({ repoRoot, repoHealth, ledgerChain } = {}) {
  const generatedAt = nowIso();
  const verificationRecords = listVerificationRecords({ repoRoot, repoHealth, ledgerChain });
  const releaseCandidates = listReleaseCandidates({ repoRoot });
  return {
    schema: 'dreamfeed-release-evidence/v1',
    exportVersion: 1,
    schemaVersion: store.SCHEMA_VERSION,
    generatedAt,
    project: repoRoot ? { scope: 'project', rootToken: rootToken(repoRoot) } : { scope: 'none', rootToken: null },
    counts: releaseCounts(verificationRecords, releaseCandidates),
    verificationRecords,
    releaseCandidates,
  };
}

module.exports = {
  VERIFICATION_STATES,
  RELEASE_STATES,
  draftVerificationRecord,
  applyVerificationRecordCreate,
  draftReleaseCandidate,
  applyReleaseCandidateUpsert,
  applyReleaseState,
  listVerificationRecords,
  listReleaseCandidates,
  exportReleaseEvidence,
  releaseCounts,
  safeVerificationSummary,
  safeReleaseSummary,
  deriveVerificationCurrency,
  requireVisibleVerification,
  requireVisibleRelease,
};
