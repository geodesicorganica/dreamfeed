'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
function lensRegistry() {
  const app = read('public', 'app.js');
  const match = app.match(/const LENS_REGISTRY = Object\.freeze\((\{[\s\S]*?\n\})\);/);
  assert.ok(match, 'lens registry object is declared');
  return Function(`"use strict"; return (${match[1]});`)();
}

test('Dreamfeed shell exposes five persistent operating regions', () => {
  const html = read('public', 'index.html');
  for (const id of ['sidebar', 'commandBar', 'main', 'inspector', 'bottomPanel']) {
    assert.match(html, new RegExp(`id="${id}"`), `missing persistent region: ${id}`);
  }
  assert.match(html, /id="refreshBtn"/, 'command bar keeps source refresh available');
  assert.match(html, /id="projectBtn"/, 'command bar exposes the project switcher control');
  assert.match(html, /id="projectDialog"/, 'project switch is a popover/dialog, not an inline path field');
  assert.match(html, /id="densityBtn"/, 'command bar exposes in-memory density control');
});

test('project switcher: native Select folder is primary, manual is the labeled fallback, token is header-only', () => {
  const html = read('public', 'index.html');
  const app = read('public', 'app.js');
  assert.match(html, /id="projectBrowser"/, 'in-app folder browser (explorer) is present');
  assert.match(html, /id="pbUse"/, 'Open this folder action is present');
  assert.match(html, /id="projectSelectFolder"/, 'native dialog remains available as a secondary picker');
  assert.match(html, /id="projectRecentWrap"/, 'recent-projects region exists');
  assert.match(html, /Type a path instead/, 'manual path is demoted to a labeled fallback');
  assert.match(app, /function browseTo\(/, 'in-app folder navigation exists');
  assert.match(app, /function selectFolder\(/, 'select-folder flow exists');
  assert.match(app, /'X-Dreamfeed-Token'/, 'guarded calls carry the action token as a custom header');
  assert.doesNotMatch(app, /[?&]token=.*actionToken|actionToken[^)]*query/i, 'action token is not put in query params');
  assert.doesNotMatch(app, /localStorage|sessionStorage|document\.cookie/, 'action token is never persisted to browser storage');
  assert.match(html, /id="inspectorToggle"/, 'command bar can control inspector visibility');
  assert.match(html, /id="bottomToggle"/, 'command bar can control validation panel visibility');
});

test('explicit lens registry maps every retained Command Center tab', () => {
  const html = read('public', 'index.html');
  const app = read('public', 'app.js');
  const registry = lensRegistry();
  assert.deepEqual(Object.keys(registry), ['Queue', 'Dashboard', 'Board', 'Table', 'Document', 'IDE', 'Topology']);
  assert.deepEqual(registry.Queue, { tabs: ['daily', 'work'], defaultTab: 'daily' });
  assert.deepEqual(registry.Dashboard, { tabs: ['overview', 'memory', 'releases', 'learning'], defaultTab: 'overview' });
  assert.deepEqual(registry.Board, { tabs: ['board', 'queue', 'milestones'], defaultTab: 'board' });
  assert.deepEqual(registry.Table, { tabs: ['sources', 'health'], defaultTab: 'sources' });
  assert.deepEqual(registry.Document, { tabs: ['roadmap', 'review'], defaultTab: 'review' });
  assert.deepEqual(registry.IDE, { tabs: ['review'], defaultTab: 'review', inspectorMode: 'evidence' });
  assert.deepEqual(registry.Topology, { tabs: ['topology'], defaultTab: 'topology' });
  for (const tab of ['daily', 'work', 'overview', 'memory', 'releases', 'board', 'queue', 'topology', 'roadmap', 'milestones', 'review', 'learning', 'sources', 'health']) {
    assert.match(html, new RegExp(`data-tab="${tab}"`), `retained module tab is missing: ${tab}`);
  }
  assert.match(app, /function goLens\(lens\)/, 'lens control resolves to a retained default tab');
});

test('Gate G surfaces: workstream navigator, queue lens, approval dialog, assistant dock, status strip', () => {
  const html = read('public', 'index.html');
  const app = read('public', 'app.js');
  assert.match(html, /id="workNav"/, 'Goals/Operations navigator region exists in the sidebar');
  assert.match(html, /id="approvalDialog"/, 'approval is an explicit dialog, never implicit');
  assert.match(html, /id="apConfirm"/, 'founder-class approvals expose the typed-confirmation input');
  assert.match(app, /function renderDaily\(\)/, 'daily queue lens exists');
  assert.match(app, /function renderWork\(\)/, 'work detail lens exists');
  assert.match(app, /function renderWorkNav\(\)/, 'workstream navigator renders Goals and Operations trees');
  assert.match(app, /function renderAssistant\(/, 'assistant dock exists as a right-region mode');
  assert.match(app, /function renderMemory\(\)/, 'governed memory lens exists');
  assert.match(app, /id="memoryScope"/, 'memory lens exposes scope filtering');
  assert.match(app, /id="memoryTag"/, 'memory lens exposes tag filtering');
  assert.match(app, /deleted-tombstone/, 'memory lens exposes tombstone inspection state');
  assert.match(app, /retrieval: \$\{esc\(memoryReasonLine\(m\)\)\}/, 'memory cards show retrieval reasons');
  assert.match(app, /function renderMemoryOverview\(/, 'memory provenance inspector exists');
  assert.match(app, /Memory provenance inspector/, 'memory inspector names provenance explicitly');
  assert.match(app, /function memoryEmptyState\(/, 'memory lens has explicit empty and error states');
  assert.match(app, /function memoryLifecycleTrace\(/, 'memory inspector derives lifecycle and ledger trace links');
  assert.match(app, /dreamfeed-memory-export-v/, 'memory export uses a deterministic JSON filename');
  assert.match(app, /data-right-mode="assistant"/, 'inspector ⇄ assistant mode toggle exists');
  for (const mode of ['chief-of-staff', 'translator', 'chat']) {
    assert.ok(app.includes(`'${mode}'`), `assistant mode present: ${mode}`);
  }
  assert.match(app, /function renderStatusStrip\(\)/, 'bottom status strip exists');
  assert.match(app, /data-git-op=/, 'named git actions surface in the status strip');
  for (const op of ['git-add', 'git-commit', 'git-branch', 'git-switch', 'git-push']) {
    assert.ok(app.includes(`'${op}'`), `named git action wired: ${op}`);
  }
  assert.match(app, /writeReadiness/, 'git actions are gated by per-op readiness verdicts');
  assert.match(app, /function runGitAction\(/, 'git actions raise intents through the governed lifecycle');
  assert.match(app, /function postMutation\(/, 'mutations go through one guarded POST helper');
  assert.match(app, /'X-Dreamfeed-Token': actionToken/, 'mutation helper carries the action token header');
  assert.doesNotMatch(app, /fetch\([^)]*token=/, 'no token ever appears in a query string');
  assert.match(app, /\/api\/work\/tasks\/transition/, 'task transitions use the governed sugar route');
  assert.match(app, /\/api\/plans\/\$\{id\}\/approve/, 'approval posts to the lifecycle route');
  assert.match(app, /streamType/, 'queue rows keep their goal/operation stream identity');
  assert.match(app, /data-memory-propose/, 'memory proposals start from the Memory lens form');
  assert.match(app, /data-memory-from-assistant/, 'assistant messages can be proposed as memory without auto-saving');
  assert.match(app, /Memory context sent/, 'assistant dock shows the exact memory context sent');
  assert.match(app, /memoryContextVisible/, 'assistant stores the server-visible memory context');
  assert.match(app, /memoryIdsUsed/, 'assistant shows exact memory ids used');
  assert.match(app, /contextMeta/, 'assistant exposes memory context cap metadata');
  assert.match(app, /memoryCitations/, 'assistant exposes memory citation metadata');
  assert.match(app, /memoryCitationWarning/, 'assistant exposes missing-citation warnings');
  assert.match(app, /function renderReleases\(\)/, 'D35 release cockpit lens exists');
  assert.match(app, /data-verification-propose/, 'verification records are proposed through the release lens');
  assert.match(app, /data-release-propose/, 'release candidates are proposed through the release lens');
  assert.match(app, /data-release-ship/, 'shipped state is explicit and founder-classed through lifecycle');
  assert.match(app, /dreamfeed-release-evidence-v/, 'release evidence export uses a deterministic JSON filename');
  assert.match(app, /function renderReleaseOverview\(/, 'release and verification records use the shared provenance inspector');
  assert.match(app, /\/api\/releases/, 'release lens reads guarded release APIs');
});

test('selection is derived over existing state and routes evidence into the shared inspector', () => {
  const html = read('public', 'index.html');
  const app = read('public', 'app.js');
  assert.match(app, /function buildObjectRegistry\(\)/, 'derived UI registry exists');
  assert.match(app, /function selectObject\(id/, 'cards, graph nodes, and rows share selection state');
  assert.match(app, /function renderInspector\(\)/, 'shared inspector renders selected object');
  assert.match(app, /function openEvidence\(path/, 'source evidence is opened through the inspector');
  assert.match(app, /function renderEvidenceView\(item\)/, 'evidence view is factored for rendered/raw source display');
  assert.match(app, /function renderMarkdown\(markdown\)/, 'markdown renderer is local and zero-dependency');
  assert.match(app, /view\.evidenceMode = isMarkdownPath\(path\) \? 'rendered' : 'raw';/, 'markdown evidence opens rendered by default');
  assert.match(app, /data-evidence-mode="rendered"/, 'markdown evidence exposes rendered mode');
  assert.match(app, /data-evidence-mode="raw"/, 'markdown evidence preserves raw source mode');
  assert.match(app, /class="markdown-body"/, 'rendered markdown uses a scoped markdown body container');
  assert.doesNotMatch(app, /DOMParser|sanitizeHTML|marked\.min|DOMPurify/, 'markdown preview does not rely on sanitizer-first or vendored parser paths');
  assert.ok(app.includes('const sourceId = `source:${path}`;'), 'existing source registry identity is reused for evidence paths');
  assert.ok(app.includes('const id = `file:${path}`;'), 'file identity remains only as a fallback path');
  assert.match(app, /fieldValue\(o\.decision_maker, fieldValue\(o\.target_agent\)\)/, 'approval owner fallback unwraps decision_maker before target_agent');
  assert.match(app, /let evidenceRequestId = 0;/, 'evidence fetches carry a request guard');
  assert.match(app, /requestId !== evidenceRequestId \|\| view\.evidence\?\.path !== path/, 'stale evidence responses cannot overwrite current inspector state');
  assert.doesNotMatch(html, /id="sidepanel"/, 'legacy overlay source viewer is removed');
  assert.doesNotMatch(app, /localStorage|sessionStorage|indexedDB|document\.cookie|history\.(pushState|replaceState)|location\.(hash|search)/, 'V1 cockpit state is not persisted across reload surfaces');
  assert.match(app, /const view = \{\s*tab: 'daily'/, 'reload starts from the daily queue landing state');
});

test('topology graph normalizes node kinds before layout and SVG classification', () => {
  const app = read('public', 'app.js');
  assert.match(app, /kind: fieldValue\(n\.nodeType, 'artifact'\)/, 'source topology node kind is normalized to a string');
  assert.match(app, /const kind = endpointKind\(type, key, direction\)/, 'synthetic endpoint kind remains a string');
  assert.doesNotMatch(app, /kind: n\.nodeType/, 'wrapped nodeType fields are not stored as graph node kind');
  assert.match(app, /meta\.kind === 'agent'/, 'graph SVG classifies normalized kind strings');
  assert.match(app, /meta\.kind\.includes\('planned'\)/, 'graph SVG planned-node check operates on normalized kind strings');
  assert.match(app, /n\.kind === 'artifact'/, 'artifact filtering operates on normalized kind strings');
});

test('D32: topology geometry is delegated to the human-rooted orchestrator', () => {
  const app = read('public', 'app.js');
  const html = read('public', 'index.html');
  const server = read('src', 'server.js');
  assert.match(app, /DreamfeedLayout\.orchestrate\(/, 'graphLayout delegates geometry to public/layout.js');
  assert.match(app, /function registerHumanRoot\(spec\)/, 'the human root gets a UI record like synthetic endpoints');
  assert.match(app, /graphStrategy: 'auto'/, 'strategy override starts on auto and lives in view state');
  assert.match(app, /data-strategy/, 'strategy override is a visible control');
  assert.match(app, /data-loop/, 'loops are selectable for highlight');
  assert.match(html, /<script src="\/layout\.js"><\/script>/, 'layout module has a script tag');
  assert.ok(html.indexOf('/layout.js') < html.indexOf('/app.js'), 'layout.js loads before app.js');
  assert.match(server, /'\/layout\.js'/, 'layout.js is an explicit STATIC route');
});

test('D32: discovered candidate promotion uses source-stable ids and source links', () => {
  const app = read('public', 'app.js');
  assert.match(app, /function candidateManifestId\(candidate\)/, 'promotion id generation is factored');
  assert.match(app, /candidate\.sourcePath \|\| candidate\.id \|\| candidate\.name/, 'promotion ids are derived from source path before display name');
  assert.ok(
    app.includes('const source = n.ref ? sourceInfo(n.ref.source_evidence)?.path : n.src ? n.src : isFileRef(n.key) ? n.key : null;'),
    'discovered node rows link to the real discovery source path before synthetic ids');
});

test('topology graph registers synthetic endpoints before exposing selectable rows', () => {
  const app = read('public', 'app.js');
  assert.match(app, /function registerSyntheticTopologyEndpoint\(endpoint\)/, 'synthetic topology endpoint registry exists');
  assert.match(app, /registerSyntheticTopologyEndpoint\(node\);\s*nodes\.push\(node\);/, 'synthetic endpoint is registered before it is rendered/selectable');
  assert.match(app, /addSynthetic\(from, type, 'from'\);/, 'missing from endpoints are included in graph nodes');
  assert.match(app, /addSynthetic\(to, type, 'to'\);/, 'missing to endpoints are included in graph nodes');
  assert.match(app, /graphEdges\(positions\)/, 'edge rendering still uses full topology edge inventory');
  assert.match(app, /state\.topology\.edges\.forEach/, 'edge drawing iterates source topology edges instead of node-only inventory');
});

test('Dreamfeed tokens, Verified Node, and self-hosted IBM Plex routes are local-only', () => {
  const html = read('public', 'index.html');
  const server = read('src', 'server.js');
  const fonts = read('public', 'dreamfeed', 'fonts.css');
  assert.match(html, /\/dreamfeed\/assets\/logo-lockup\.svg/, 'uses the canonical Verified Node lockup');
  assert.match(html, /\/dreamfeed\/tokens\/colors\.css/, 'uses canonical token CSS route');
  assert.match(html, /\/dreamfeed\/tokens\/typography\.css/, 'uses canonical typography token route');
  assert.match(server, /\/dreamfeed\/assets\/logo-lockup\.svg/, 'logo route is explicit');
  assert.match(server, /\/dreamfeed\/tokens\/colors\.css/, 'token route is explicit');
  assert.match(server, /IBMPlexSans-Regular\.woff2/, 'self-hosted font route is explicit');
  assert.match(fonts, /font-family: "IBM Plex Sans"/, 'IBM Plex Sans is self-hosted');
  assert.match(fonts, /font-family: "IBM Plex Mono"/, 'IBM Plex Mono is self-hosted');
  const fontUrls = [...fonts.matchAll(/url\("([^"]+)"\)/g)].map((match) => match[1]);
  assert.ok(fontUrls.length >= 8, 'font CSS declares expected IBM Plex font files');
  assert.ok(fontUrls.every((url) => url.startsWith('/dreamfeed/fonts/')), 'all font URLs use the local Dreamfeed font route');
  assert.ok(fontUrls.some((url) => url.includes('IBMPlexSans-')), 'IBM Plex Sans file URLs are explicit');
  assert.ok(fontUrls.some((url) => url.includes('IBMPlexMono-')), 'IBM Plex Mono file URLs are explicit');
  assert.doesNotMatch(fonts, /https?:\/\//, 'font CSS has no external runtime dependency');
});
