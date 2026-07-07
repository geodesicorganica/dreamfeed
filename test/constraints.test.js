'use strict';
// PS-003 / Gate G constraint regression suite (D31). Encodes the envelope from
// docs/decisions/d31-write-enabled-command-surface.md as tests, so a violating
// change fails `npm test` instead of relying on reviewer discipline.
//
// Behavior-first where possible. The suite is parameterized by the server's
// exported MUTATING_ROUTES table: routes not enumerated there must refuse every
// non-GET method with 405; routes enumerated there must refuse unguarded
// requests (no action token) with 403 and undeclared methods with 405.
const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Backstop: never open a real OS folder dialog from the test suite.
process.env.DREAMFEED_NO_NATIVE = '1';

const server = require('../src/server');

const ROOT = path.join(__dirname, '..');
// { '/api/intents': ['POST'], ... }. Assert the export exists and is populated
// so a rename/drop of the table can't silently turn the envelope tests below
// into vacuous zero-iteration no-ops.
const MUTATING = server.MUTATING_ROUTES || {};
test('envelope table is exported and non-empty (guards the tests below from going vacuous)', () => {
  assert.ok(Object.keys(MUTATING).length >= 6, 'MUTATING_ROUTES export must enumerate the mutating surface');
});

let base;
before(async () => {
  await new Promise((resolve) => server.server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.server.address().port}`;
});
after(() => { server.server.close(); });

// --- method policy -------------------------------------------------------------

test('method policy: non-GET is 405 everywhere except the enumerated mutating routes', async () => {
  const readRoutes = [
    '/',
    '/api/state',
    '/api/repo-health',
    '/api/project',
    '/api/project?root=' + encodeURIComponent(ROOT),
    '/api/nonexistent-route',
  ];
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    for (const route of readRoutes) {
      const res = await fetch(base + route, { method });
      assert.strictEqual(res.status, 405, `${method} ${route} must be 405`);
    }
  }
});

test('method policy: mutating routes refuse unguarded requests and undeclared methods', async () => {
  for (const [route, methods] of Object.entries(MUTATING)) {
    for (const method of methods) {
      // No X-Dreamfeed-Token → the mutation guard must refuse before any handler
      // logic runs. 403 (guard), never 2xx and never a handler error.
      const res = await fetch(base + route, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      assert.strictEqual(res.status, 403, `unguarded ${method} ${route} must be 403`);
    }
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      if (methods.includes(method)) continue;
      const res = await fetch(base + route, { method });
      assert.strictEqual(res.status, 405, `undeclared ${method} ${route} must be 405`);
    }
  }
});

// --- governed writes: no direct write path in src/ ------------------------------

test('read-only outside the write engine: fs writes in src/ are allowlisted', () => {
  const WRITE_CALL = /\bfs\.(writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|mkdir|mkdirSync|unlink|unlinkSync|rm|rmSync|rmdir|rmdirSync|rename|renameSync|copyFile|copyFileSync|truncate|truncateSync)\b/;
  // Files permitted to contain fs writes under Gate G. write.js is the single
  // containment-checked source-repo write path; the commands/ store+ledger
  // write only inside the .dreamfeed/ sidecar; server.js only the project
  // sidecar line. Everything else in src/ stays read-only.
  const ALLOWED_FILES = new Set(['write.js', path.join('commands', 'ledger.js'), path.join('commands', 'store.js')]);
  const files = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.js')) files.push(p);
    }
  })(path.join(ROOT, 'src'));
  for (const file of files) {
    const rel = path.relative(path.join(ROOT, 'src'), file);
    if (ALLOWED_FILES.has(rel)) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!WRITE_CALL.test(line)) return;
      const ok = rel === 'server.js' && line.includes('PROJECT_CONFIG_FILE');
      assert.ok(ok, `src/${rel}:${i + 1} contains an fs write outside the governed write engine: ${line.trim()}`);
    });
  }
});

// --- loopback serving / no hardcoded egress --------------------------------------

test('loopback-only: no hardcoded external-origin URLs in served or server source files', () => {
  // Hosts that are not network origins: loopback, the URL-parsing base in
  // app.js, and the W3C namespace URIs baked into SVG/XHTML. Assistant provider
  // endpoints must come from assistant-config.json (D31), never from source
  // literals — so src/ has no exemption.
  const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', 'dreamfeed.local', 'www.w3.org']);
  const SERVED_EXT = new Set(['.html', '.js', '.css', '.svg']);
  const URL_RE = /https?:\/\/([^\s/"'`)>;,]+)/g;

  const files = [];
  (function walk(dir, exts) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p, exts);
      else if (exts.has(path.extname(entry.name))) files.push(p);
    }
  })(path.join(ROOT, 'public'), SERVED_EXT);
  (function walkSrc(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walkSrc(p);
      else if (entry.name.endsWith('.js')) files.push(p);
    }
  })(path.join(ROOT, 'src'));

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(URL_RE)) {
      // Strip any port (including template-literal ports like `:${PORT}`),
      // preserving bracketed IPv6 hosts.
      const host = m[1].startsWith('[') ? m[1].slice(0, m[1].indexOf(']') + 1) : m[1].split(':')[0];
      assert.ok(ALLOWED_HOSTS.has(host),
        `${path.relative(ROOT, file)} references external origin "${m[0]}" — endpoints come from config, never source literals`);
    }
  }
});

// --- zero runtime dependencies -------------------------------------------------

test('zero-dep: package.json declares no runtime dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    const deps = Object.keys(pkg[field] || {});
    assert.deepStrictEqual(deps, [], `package.json ${field} must stay empty; found: ${deps.join(', ')}`);
  }
});

// --- denied operations are structurally unplannable ------------------------------

// --- D32: adoption bridge stays inside the Gate G envelope -----------------------

test('D32: the mutating-route set is exactly the D31 seven — promotion adds an intent kind, not a route', () => {
  assert.deepStrictEqual(
    Object.fromEntries(Object.entries(MUTATING).map(([r, m]) => [r, [...m]])),
    {
      '/api/intents': ['POST'],
      '/api/intents/:id/plan': ['POST'],
      '/api/plans/:id/approve': ['POST'],
      '/api/plans/:id/execute': ['POST'],
      '/api/executions/:id/rollback': ['POST'],
      '/api/work/tasks/transition': ['POST'],
      '/api/assistant/:mode/messages': ['POST'],
    },
    'D32 must not expand the mutating surface; promote-topology rides the existing lifecycle routes');
});

test('D32: promote-topology is explicitly policy-classed approve in the defaults', () => {
  const { DEFAULTS } = require('../src/commands/policy');
  assert.strictEqual(DEFAULTS['promote-topology'], 'approve',
    'promote-topology must be declared in policy defaults (unknown operations are denied)');
});

test('D32: /api/discovery exists and is GET-only', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const res = await fetch(base + '/api/discovery', { method });
    assert.strictEqual(res.status, 405, `${method} /api/discovery must be 405`);
  }
  const res = await fetch(base + '/api/discovery');
  assert.notStrictEqual(res.status, 404, 'GET /api/discovery must be a real route');
  assert.notStrictEqual(res.status, 405, 'GET /api/discovery must accept GET');
});

test('denied class: git force-push and history rewrites never appear in the executor allowlist', () => {
  // Static guard until (and after) the executor exists: no src/ file may build
  // a git invocation containing force/history-rewrite flags.
  const FORBIDDEN = /(push[^;\n]*--force|--force-with-lease|filter-branch|reset\s+--hard[^;\n]*origin)/;
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.js')) {
        const text = fs.readFileSync(p, 'utf8');
        assert.ok(!FORBIDDEN.test(text), `${path.relative(ROOT, p)} contains a forbidden git operation`);
      }
    }
  })(path.join(ROOT, 'src'));
});
