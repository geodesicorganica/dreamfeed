'use strict';
// Universal-repo degradation suite (2026-07-12 pass over C:\Projects): any
// existing repo must load with honest empty states, not error walls or false
// candidates. Pins the fixes found by probing real Next.js / Firebase / plain
// folders: absent-family ≠ parse errors, roadmap absence is quiet, discovery
// ignores build output, never flags binaries, and matches Docs/ on any case.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DREAMFEED_NO_NATIVE = '1';

const { buildState } = require('../src/state');
const { buildRoadmap } = require('../src/topology');
const { discover, IGNORE } = require('../src/discovery');
const { buildImports } = require('../src/onboarding/importers');

function tmp(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }
function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

test('absent Stakeport family: zero parse errors, family flag false', () => {
  const root = tmp('df-univ-plain-');
  write(root, 'README.md', '# Plain app\n');
  write(root, 'src/index.js', 'console.log(1);\n');
  const s = buildState({ repoRoot: root });
  assert.strictEqual(s.stakeportFamilyPresent, false);
  assert.deepStrictEqual(s.parseErrors, [], 'a repo that never adopted the family reports NO errors');
});

test('partial Stakeport family: missing siblings ARE reported', () => {
  const root = tmp('df-univ-partial-');
  write(root, 'agents/founder/outputs/strategic_initiatives.md',
    '# Initiatives\n\n| Initiative | Stage | Status | Owner | Success Definition |\n|---|---|---|---|---|\n| X | crawl | active | F | works |\n');
  const s = buildState({ repoRoot: root });
  assert.strictEqual(s.stakeportFamilyPresent, true);
  assert.ok(s.parseErrors.some((e) => /weekly_priorities/.test(e.path)), 'partial adoption keeps missing-file errors loud');
});

test('roadmap: no CLAUDE.md and no Phase section are quiet; malformed section still errors', () => {
  const bare = tmp('df-univ-rm1-');
  assert.deepStrictEqual(buildRoadmap(bare), { objects: [], errors: [] }, 'missing CLAUDE.md is not an error');
  const noSection = tmp('df-univ-rm2-');
  write(noSection, 'CLAUDE.md', '# Rules\n\nNo roadmap here.\n');
  assert.deepStrictEqual(buildRoadmap(noSection), { objects: [], errors: [] }, 'missing section is not an error');
  const malformed = tmp('df-univ-rm3-');
  write(malformed, 'CLAUDE.md', '# Rules\n\n## Phase sequencing\n\nProse without any phase bullets.\n');
  const out = buildRoadmap(malformed);
  assert.strictEqual(out.errors.length, 1, 'a present-but-unparseable section is a genuine authoring error');
});

test('discovery: build output ignored, binaries never agents, Docs/ matches any case', () => {
  const root = tmp('df-univ-disc-');
  write(root, '.next/server/junk1.js', 'x');
  write(root, '.next/server/junk2.js', 'x');
  write(root, 'coverage/lcov.info', 'x');
  write(root, 'tools/management_agent.dll', 'MZbinary');
  write(root, 'tools/planner.md', '# Planner\n');
  write(root, 'Docs/handbook.md', '# Handbook\n');
  write(root, 'README.md', '# App\n');
  const d = discover(root);
  const byPath = new Map(d.candidates.map((c) => [c.sourcePath, c]));
  assert.ok(!byPath.has('tools/management_agent.dll'), 'binary is never an agent candidate');
  assert.strictEqual(byPath.get('Docs/handbook.md')?.kind, 'document', 'Docs/ matches case-insensitively');
  assert.ok(!d.rollups.some((r) => r.sourcePath === '.next' || r.sourcePath === 'coverage'), 'build output neither scanned nor rolled up');
  assert.ok(IGNORE.has('.next') && IGNORE.has('__pycache__'), 'ignore set covers common build/vendor dirs');
});

test('importers: package.json description prefills the one-liner; the folder name stays the business name', () => {
  const root = tmp('df-univ-pkg-');
  write(root, 'package.json', JSON.stringify({ name: 'react-example', description: 'Storefront for model rockets.' }));
  const imp = buildImports(root);
  assert.strictEqual(imp.prefills.evidence['q-business-name'], 'folder name',
    'boilerplate package names must not displace the user-chosen folder name');
  assert.strictEqual(imp.prefills.answers['q-one-liner'], 'Storefront for model rockets.');
  assert.strictEqual(imp.prefills.evidence['q-one-liner'], 'package.json description');
});
