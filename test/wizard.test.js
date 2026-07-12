'use strict';
// D36 wizard walker suite: the pure traversal module (public/wizard.js) in
// node, against the REAL question tree the server serves — plus the greenfield
// /api/project/create route (folders.js containment).
const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DREAMFEED_NO_NATIVE = '1';
process.env.DREAMFEED_NO_PROBE = '1';
if (!process.env.DREAMFEED_STATE_DIR) {
  process.env.DREAMFEED_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'df-state-'));
}

const wizard = require('../public/wizard');
const { QUESTIONS } = require('../src/onboarding/questions');
const { createProjectFolder } = require('../src/onboarding/folders');
const server = require('../src/server');

let base, token;
before(async () => {
  await new Promise((resolve) => server.server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.server.address().port}`;
  token = (await (await fetch(base + '/api/project')).json()).actionToken;
});
after(() => { server.server.close(); });

test('walker: first question is the first visible unanswered one; interview terminates', () => {
  const first = wizard.nextQuestion(QUESTIONS, {}, {});
  assert.strictEqual(first.id, 'q-business-name');
  // Answer everything visible → walker returns null (interview complete).
  const answers = {};
  const seen = {};
  let q, guard = 0;
  while ((q = wizard.nextQuestion(QUESTIONS, answers, seen)) && guard++ < 100) {
    answers[q.id] = q.kind === 'multi' ? [q.options[0].value] : q.kind === 'choice' ? q.options[0].value : q.kind === 'date' ? '2026-09-30' : 'answer';
    seen[q.id] = true;
  }
  assert.ok(guard < 100, 'walker terminates');
  assert.strictEqual(wizard.nextQuestion(QUESTIONS, answers, seen), null);
  assert.strictEqual(wizard.progress(QUESTIONS, answers).done, true);
});

test('walker: required questions cannot be skipped past, optional ones can', () => {
  const seen = { 'q-business-name': true }; // "seen" but unanswered
  const q = wizard.nextQuestion(QUESTIONS, {}, seen);
  assert.strictEqual(q.id, 'q-business-name', 'required question comes back even when seen');
  const optional = QUESTIONS.find((x) => !x.required);
  assert.ok(wizard.validateAnswer(optional, '').ok, 'optional accepts empty');
  assert.ok(!wizard.validateAnswer(QUESTIONS[0], ' ').ok, 'required rejects whitespace');
});

test('walker: branching matches the server tree (idea vs operating)', () => {
  const ideaVis = wizard.visibleQuestions(QUESTIONS, { 'q-stage': 'idea' }).map((q) => q.id);
  assert.ok(ideaVis.includes('q-model-hypothesis') && !ideaVis.includes('q-model'));
  const opVis = wizard.visibleQuestions(QUESTIONS, { 'q-stage': 'operating' }).map((q) => q.id);
  assert.ok(opVis.includes('q-model') && !opVis.includes('q-model-hypothesis'));
});

test('walker: validation rejects bad dates and unlisted options', () => {
  const dateQ = QUESTIONS.find((q) => q.kind === 'date');
  assert.ok(!wizard.validateAnswer(dateQ, 'next month').ok);
  assert.ok(wizard.validateAnswer(dateQ, '2026-10-01').ok);
  const choiceQ = QUESTIONS.find((q) => q.kind === 'choice');
  assert.ok(!wizard.validateAnswer(choiceQ, 'not-an-option').ok);
  const multiQ = QUESTIONS.find((q) => q.kind === 'multi');
  assert.ok(!wizard.validateAnswer(multiQ, ['nope']).ok);
  assert.ok(wizard.validateAnswer(multiQ, [multiQ.options[0].value]).ok);
});

// --- greenfield folder creation ------------------------------------------------

test('createProjectFolder: containment and naming rules', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'df-parent-'));
  assert.ok(createProjectFolder('relative/path', 'x').error, 'parent must be absolute');
  assert.ok(createProjectFolder(parent, '../escape').error, 'no separators');
  assert.ok(createProjectFolder(parent, 'con').error, 'reserved names rejected');
  assert.ok(createProjectFolder(parent, '.hidden').error, 'no leading dot');
  const appRoot = path.join(__dirname, '..');
  assert.ok(createProjectFolder(appRoot, 'inside-app').error, 'never inside the app folder');
  const made = createProjectFolder(parent, 'my-venture');
  assert.ok(made.root && fs.existsSync(made.root), 'folder created');
  assert.ok(createProjectFolder(parent, 'my-venture').error, 'existing target refused');
});

test('POST /api/project/create: guarded, creates + switches, ledgered without paths', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'df-parent2-'));
  const unguarded = await fetch(base + '/api/project/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent, name: 'x' }),
  });
  assert.strictEqual(unguarded.status, 403);

  const res = await fetch(base + '/api/project/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Dreamfeed-Token': token },
    body: JSON.stringify({ parent, name: 'greenfield-venture' }),
  });
  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.configured, true);
  assert.ok(body.currentRoot.endsWith('greenfield-venture'));
  assert.ok(fs.existsSync(body.currentRoot));

  const ledger = await (await fetch(base + '/api/ledger')).json();
  const ev = ledger.events.filter((e) => e.type === 'project-created');
  assert.ok(ev.length >= 1, 'creation is ledgered');
  assert.ok(!JSON.stringify(ev).includes('greenfield-venture'), 'ledger carries the rootToken, not the local path');

  const bad = await fetch(base + '/api/project/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Dreamfeed-Token': token },
    body: JSON.stringify({ parent, name: 'greenfield-venture' }),
  });
  assert.strictEqual(bad.status, 400, 'existing target refused');
  server._setCurrentRoot(null);
});
