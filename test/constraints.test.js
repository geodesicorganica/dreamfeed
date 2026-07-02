'use strict';
// PS-002 Phase 1 / Gate F constraint regression suite. Encodes the manual
// constraint checklist (docs/workflows/verification-workflow.md) as tests, so a
// violating change fails `npm test` instead of relying on reviewer discipline.
//
// Behavior-first where possible: the GET-only invariant is asserted against a
// live server, not by scanning source for route registrations. The remaining
// invariants (write paths, external origins, zero dependencies) are static
// scans with narrow, documented allowlists.
const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Backstop: never open a real OS folder dialog from the test suite.
process.env.DREAMFEED_NO_NATIVE = '1';

const server = require('../src/server');

const ROOT = path.join(__dirname, '..');

let base;
before(async () => {
  await new Promise((resolve) => server.server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.server.address().port}`;
});
after(() => { server.server.close(); });

// --- GET-only ----------------------------------------------------------------

test('GET-only: POST/PUT/PATCH/DELETE are refused with 405 on every surface', async () => {
  const routes = [
    '/',
    '/api/state',
    '/api/repo-health',
    '/api/project',
    // A mutation attempt via a non-GET method must be refused by the method
    // guard before any project-switch logic runs.
    '/api/project?root=' + encodeURIComponent(ROOT),
  ];
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    for (const route of routes) {
      const res = await fetch(base + route, { method });
      assert.strictEqual(res.status, 405, `${method} ${route} must be 405`);
    }
  }
});

// --- read-only: no write paths to source repositories -------------------------

test('read-only: the only fs write in src/ is the cockpit-local project sidecar', () => {
  const WRITE_CALL = /\bfs\.(writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|mkdir|mkdirSync|unlink|unlinkSync|rm|rmSync|rmdir|rmdirSync|rename|renameSync|copyFile|copyFileSync|truncate|truncateSync)\b/;
  for (const name of fs.readdirSync(path.join(ROOT, 'src')).filter((n) => n.endsWith('.js'))) {
    const lines = fs.readFileSync(path.join(ROOT, 'src', name), 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!WRITE_CALL.test(line)) return;
      const ok = name === 'server.js' && line.includes('PROJECT_CONFIG_FILE');
      assert.ok(ok, `src/${name}:${i + 1} contains an fs write outside the project-config sidecar: ${line.trim()}`);
    });
  }
});

// --- localhost-only / self-hosted assets --------------------------------------

test('localhost-only: no external-origin URLs in served or server source files', () => {
  // Hosts that are not network origins: loopback, the URL-parsing base in
  // app.js, and the W3C namespace URIs baked into SVG/XHTML.
  const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', 'dreamfeed.local', 'www.w3.org']);
  const SERVED_EXT = new Set(['.html', '.js', '.css', '.svg']);
  const URL_RE = /https?:\/\/([^\s/"'`)>;,]+)/g;

  const files = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (SERVED_EXT.has(path.extname(entry.name))) files.push(p);
    }
  })(path.join(ROOT, 'public'));
  for (const name of fs.readdirSync(path.join(ROOT, 'src')).filter((n) => n.endsWith('.js'))) {
    files.push(path.join(ROOT, 'src', name));
  }

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(URL_RE)) {
      // Strip any port (including template-literal ports like `:${PORT}`),
      // preserving bracketed IPv6 hosts.
      const host = m[1].startsWith('[') ? m[1].slice(0, m[1].indexOf(']') + 1) : m[1].split(':')[0];
      assert.ok(ALLOWED_HOSTS.has(host),
        `${path.relative(ROOT, file)} references external origin "${m[0]}" — served assets must be self-hosted`);
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
