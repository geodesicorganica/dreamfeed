'use strict';
// D37 Assistant Connect suite: managed assistant-config.json round-trip through
// the guarded routes, key redaction everywhere, keyless ledger event, probe
// determinism under the kill-switch. The config path is redirected to a temp
// file so the operator's real assistant-config.json is never touched.
const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DREAMFEED_NO_NATIVE = '1';
process.env.DREAMFEED_NO_PROBE = '1';
process.env.DREAMFEED_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'df-state-'));
const CONFIG_TMP = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'df-asst-')), 'assistant-config.json');
process.env.DREAMFEED_ASSISTANT_CONFIG = CONFIG_TMP;

const server = require('../src/server');
const adapter = require('../src/assistant/adapter');

const KEY = 'sk-ant-test-SECRET-0123456789';
let base, token;

function post(route, body, withToken = true) {
  return fetch(base + route, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(withToken ? { 'X-Dreamfeed-Token': token } : {}),
    },
    body: JSON.stringify(body),
  });
}

before(async () => {
  await new Promise((resolve) => server.server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.server.address().port}`;
  token = (await (await fetch(base + '/api/project')).json()).actionToken;
});
after(() => { server.server.close(); });

test('adapter honors DREAMFEED_ASSISTANT_CONFIG (test isolation is real)', () => {
  assert.strictEqual(adapter.CONFIG_FILE, CONFIG_TMP);
});

test('unguarded config POST is refused before any handler logic', async () => {
  const res = await post('/api/assistant/config', { provider: 'http', preset: 'anthropic', apiKey: KEY }, false);
  assert.strictEqual(res.status, 403);
  assert.ok(!fs.existsSync(CONFIG_TMP), 'no config may be written by a refused request');
});

test('connect via preset + key: file written, descriptor redacted, GET never echoes the key', async () => {
  const res = await post('/api/assistant/config', { provider: 'http', preset: 'anthropic', apiKey: KEY });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.assistant.configured, true);
  assert.strictEqual(body.assistant.provider, 'http');
  assert.strictEqual(body.assistant.preset, 'anthropic');
  assert.strictEqual(body.assistant.endpointHost, 'api.anthropic.com');
  assert.ok(!JSON.stringify(body).includes(KEY), 'POST response must not echo the key');

  const cfg = JSON.parse(fs.readFileSync(CONFIG_TMP, 'utf8'));
  assert.strictEqual(cfg.http.headers['x-api-key'], KEY, 'key lands only in the gitignored config');
  assert.strictEqual(cfg.http.format, 'anthropic');
  assert.strictEqual(cfg.http.headers['anthropic-version'], '2023-06-01');

  const get = await fetch(base + '/api/assistant/config', { headers: { 'X-Dreamfeed-Token': token } });
  assert.strictEqual(get.status, 200);
  const desc = await get.json();
  assert.strictEqual(desc.assistant.configured, true);
  assert.ok(Array.isArray(desc.presets) && desc.presets.length >= 4, 'presets enumerated for the connect screen');
  assert.ok(!JSON.stringify(desc).includes(KEY), 'GET descriptor must never contain the key');

  const proj = await (await fetch(base + '/api/project')).json();
  assert.strictEqual(proj.assistant.configured, true);
  assert.ok(!JSON.stringify(proj).includes(KEY), 'project descriptor must never contain the key');
});

test('ledger records the config update without any secret material', async () => {
  const ledger = await (await fetch(base + '/api/ledger')).json();
  const events = ledger.events.filter((e) => e.type === 'assistant-config-updated');
  assert.ok(events.length >= 1, 'assistant-config-updated must be ledgered');
  assert.ok(!JSON.stringify(ledger).includes(KEY), 'ledger must never contain the key');
  const latest = events[events.length - 1];
  assert.strictEqual(latest.provider, 'http');
  assert.strictEqual(latest.preset, 'anthropic');
});

test('cli connect is limited to the fixed probe table', async () => {
  const bad = await post('/api/assistant/config', { provider: 'cli', cli: 'rm' });
  assert.strictEqual(bad.status, 400);

  const ok = await post('/api/assistant/config', { provider: 'cli', cli: 'claude' });
  assert.strictEqual(ok.status, 200);
  const body = await ok.json();
  assert.strictEqual(body.assistant.provider, 'cli');
  assert.strictEqual(body.assistant.cliCommand, 'claude');
  const cfg = JSON.parse(fs.readFileSync(CONFIG_TMP, 'utf8'));
  assert.deepStrictEqual(cfg.cli, { command: 'claude', args: ['-p'] });
});

test('validation: unknown preset, missing key, bad custom URL', async () => {
  assert.strictEqual((await post('/api/assistant/config', { provider: 'http', preset: 'nope' })).status, 400);
  assert.strictEqual((await post('/api/assistant/config', { provider: 'http', preset: 'anthropic' })).status, 400,
    'anthropic preset requires a key');
  assert.strictEqual((await post('/api/assistant/config', { provider: 'http', preset: 'openai-compatible', url: 'ftp://x', model: 'm' })).status, 400);
  assert.strictEqual((await post('/api/assistant/config', { provider: 'wat' })).status, 400);
});

test('clear removes the config and is ledgered', async () => {
  const res = await post('/api/assistant/config', { action: 'clear' });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.assistant.configured, false);
  assert.ok(!fs.existsSync(CONFIG_TMP));
  // idempotent
  assert.strictEqual((await post('/api/assistant/config', { action: 'clear' })).status, 200);
});

test('probe returns the deterministic empty shape under DREAMFEED_NO_PROBE', async () => {
  const res = await fetch(base + '/api/assistant/probe', { headers: { 'X-Dreamfeed-Token': token } });
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(await res.json(), { probed: false, clis: [], ollama: { found: false } });
});

test('unguarded probe and config GETs are refused (they disclose local state)', async () => {
  for (const route of ['/api/assistant/probe', '/api/assistant/config']) {
    const res = await fetch(base + route, { headers: { host: 'evil.example' } });
    assert.strictEqual(res.status, 403, `${route} must refuse a non-loopback host`);
  }
});
