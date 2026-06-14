'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

test('global refresh lives in the sticky nav and calls the full dashboard loader', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
  const nav = html.match(/<nav id="tabs">([\s\S]*?)<\/nav>/);
  const controls = html.match(/<div class="controls">([\s\S]*?)<\/div>/);

  assert.ok(nav, 'nav exists');
  assert.ok(controls, 'controls row exists');
  assert.match(nav[1], /id="refreshBtn"/, 'refresh button belongs to global nav');
  assert.doesNotMatch(controls[1], /id="refreshBtn"/, 'refresh button must not be a local filter control');
  assert.match(app, /fetch\('\/api\/state', \{ cache: 'no-store' \}\)/, 'refresh fetches full OS state');
  assert.match(app, /fetch\('\/api\/repo-health', \{ cache: 'no-store' \}\)/, 'refresh fetches repo health');
  assert.match(app, /refreshBtn'\)\.addEventListener\('click', \(\) => load\(\)/, 'refresh click runs the global loader');
});
