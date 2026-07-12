'use strict';
// D36 greenfield folder creation — the ONLY module allowed to mkdir (enforced
// by test/constraints.test.js), and only to create ONE new project directory
// under an existing, user-chosen parent. Never recursive over arbitrary paths,
// never inside the app root, never a governance write (the scaffold itself
// rides the governed lifecycle afterward).

const fs = require('fs');
const path = require('path');
const { canonicalRoot, canonicalKey, REPO_ROOT } = require('../parse');

// Windows-safe folder name: no reserved characters, no leading/trailing
// dot/space, no path separators, bounded length.
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._ -]{0,62}[A-Za-z0-9]$|^[A-Za-z0-9]$/;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function createProjectFolder(parent, name) {
  if (!parent || typeof parent !== 'string' || !path.isAbsolute(parent)) {
    return { error: 'parent must be an absolute path' };
  }
  let stat;
  try { stat = fs.statSync(parent); } catch { return { error: 'parent folder does not exist' }; }
  if (!stat.isDirectory()) return { error: 'parent is not a directory' };
  const trimmed = String(name || '').trim();
  if (!NAME_RE.test(trimmed) || RESERVED.test(trimmed)) return { error: 'invalid folder name' };
  const realParent = canonicalRoot(parent);
  const target = path.join(realParent, trimmed);
  const appKey = canonicalKey(REPO_ROOT);
  const targetKey = canonicalKey(target);
  if (targetKey === appKey || targetKey.startsWith(appKey + path.sep)) {
    return { error: 'cannot create a project inside the Dreamfeed app folder' };
  }
  if (fs.existsSync(target)) return { error: 'a file or folder with that name already exists' };
  try { fs.mkdirSync(target); } catch (err) {
    return { error: `folder creation failed (${(err && err.code) || 'io'})` };
  }
  return { root: target };
}

module.exports = { createProjectFolder };
