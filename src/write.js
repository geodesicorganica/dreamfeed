'use strict';
// Governed source-repo write path (D31 / Gate G). This is the ONLY module that
// may write inside a selected project root, and it may be invoked only by the
// executor with an approved, hash-revalidated plan. Containment mirrors
// readRepoFile exactly (dot-dot, string-prefix, .git/node_modules block,
// extension allowlist, size cap, realpath escape) — a write is strictly harder
// to reach than a read, never easier.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { canonicalRoot } = require('./parse');

const WRITE_EXT = new Set(['.md', '.json', '.txt']);
const WRITE_MAX_BYTES = 512 * 1024;
const NO_GIT_NODE = /(^|\/)(\.git|node_modules)(\/|$)/;

function hashText(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

// Resolve a repo-relative path for writing, applying every read-side
// containment rule. Returns { ok, abs, rel } or { error }.
function resolveForWrite(relPath, repoRoot) {
  if (!repoRoot) return { error: 'no project configured' };
  if (!relPath || typeof relPath !== 'string') return { error: 'missing path' };
  const norm = relPath.replace(/\\/g, '/');
  if (norm.includes('..')) return { error: 'path traversal rejected' };
  if (path.isAbsolute(norm) || /^[A-Za-z]:/.test(norm)) return { error: 'path must be repo-relative' };
  const realRoot = canonicalRoot(repoRoot);
  const abs = path.resolve(realRoot, norm);
  const rootPrefix = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
  if (abs !== realRoot && !abs.startsWith(rootPrefix)) return { error: 'outside repository' };
  const relCheck = path.relative(realRoot, abs).replace(/\\/g, '/');
  if (NO_GIT_NODE.test(relCheck)) return { error: 'path not writable' };
  if (!WRITE_EXT.has(path.extname(abs).toLowerCase())) return { error: 'extension not writable' };
  // Realpath containment on the nearest existing ancestor (the file itself may
  // not exist yet for a create; its parent chain must still resolve in-root).
  let probe = fs.existsSync(abs) ? abs : path.dirname(abs);
  while (!fs.existsSync(probe)) probe = path.dirname(probe);
  let real;
  try { real = fs.realpathSync(probe); } catch { return { error: 'not found' }; }
  if (real !== realRoot && !real.startsWith(rootPrefix)) return { error: 'symlink escapes repository' };
  if (NO_GIT_NODE.test(path.relative(realRoot, real).replace(/\\/g, '/'))) return { error: 'path not writable' };
  return { ok: true, abs, rel: relCheck };
}

// Atomic, drift-checked write. `baseHash` is the sha256 of the content the plan
// was computed against: if the file changed since planning, the write is
// refused (code: 'drift'). Returns the preimage for rollback.
function writeRepoFile(relPath, content, repoRoot, { baseHash } = {}) {
  const r = resolveForWrite(relPath, repoRoot);
  if (r.error) return { error: r.error, code: 'containment' };
  if (typeof content !== 'string') return { error: 'content must be a string', code: 'validation' };
  if (Buffer.byteLength(content, 'utf8') > WRITE_MAX_BYTES) {
    return { error: `content too large (cap ${WRITE_MAX_BYTES} bytes)`, code: 'validation' };
  }
  const exists = fs.existsSync(r.abs);
  const preimage = exists ? fs.readFileSync(r.abs, 'utf8') : null;
  const currentHash = exists ? hashText(preimage) : null;
  if (baseHash !== undefined && baseHash !== currentHash) {
    return { error: 'source changed since plan was computed', code: 'drift', currentHash };
  }
  try {
    fs.mkdirSync(path.dirname(r.abs), { recursive: true });
    const tmp = r.abs + `.df-tmp-${process.pid}`;
    fs.writeFileSync(tmp, content, 'utf8');
    fs.renameSync(tmp, r.abs);
  } catch (err) {
    return { error: String(err.message || err), code: 'io' };
  }
  return { ok: true, path: r.rel, preimage, preimageHash: currentHash, newHash: hashText(content) };
}

module.exports = { resolveForWrite, writeRepoFile, hashText, WRITE_EXT, WRITE_MAX_BYTES };
