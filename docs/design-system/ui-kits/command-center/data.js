/* Dreamfeed Command Center — fake typed-object data for the UI kit recreation.
   Mirrors the Unified Typed Object Model (command-center-primitives.md):
   every object exposes type, title, state, owner, source, last-observed, relations. */
window.CC_DATA = (function () {
  const objects = [
    { id: 'init-014', type: 'Strategic initiative', title: 'Phase 1.3 — IDE substitution', state: 'active', owner: 'founder', source: 'docs/strategy/ROADMAP.md', observed: '14:02Z', detail: 'Replace VSCode+Claude Code path with the Command Center IDE lens.', rels: ['work-221', 'work-219', 'rev-08'] },
    { id: 'init-009', type: 'Strategic initiative', title: 'Command Center MVP V1', state: 'live', owner: 'founder', source: 'tools/command-center/', observed: '14:02Z', detail: 'Localhost-only, read-only operating cockpit. LIVE.', rels: ['work-205', 'mile-03'] },
    { id: 'work-221', type: 'Work item', title: 'Topology lens: edge selection + provenance', state: 'active', owner: 'agent-ui', source: 'src/lenses/topology.tsx', observed: '14:02Z', detail: 'Node/edge selection wired to inspector. Provenance read-only in V1.', rels: ['init-014', 'skill-graph'] },
    { id: 'work-219', type: 'Work item', title: 'Inspector: object provenance rows', state: 'verified', owner: 'agent-ui', source: 'src/regions/inspector.tsx', observed: '13:58Z', detail: 'KeyValue provenance rows shipped, audit passed.', rels: ['init-014'] },
    { id: 'work-205', type: 'Work item', title: 'Bottom panel: execution trace map', state: 'blocked', owner: 'agent-core', source: 'src/regions/bottom.tsx', observed: '14:01Z', detail: 'Blocked: trace step schema validation failing.', rels: ['init-009', 'rev-08'] },
    { id: 'work-188', type: 'Work item', title: 'Slashed-zero font build', state: 'queued', owner: 'agent-ui', source: 'tokens/typography.css', observed: '13:40Z', detail: 'Queued behind font pipeline.', rels: [] },
    { id: 'appr-07', type: 'Approval', title: 'Deploy gate: V1 read-only boundary', state: 'pending', owner: 'founder', source: 'CLAUDE.md', observed: '14:00Z', detail: 'Awaiting founder approval to lock read-only boundary.', rels: ['init-009'] },
    { id: 'rev-08', type: 'Review', title: 'Trace schema review', state: 'failed', owner: 'agent-core', source: 'src/schema/trace.json', observed: '14:01Z', detail: 'Validation failed: DF-LIVE-ROLLBACK-001 missing affected-step field.', rels: ['work-205'] },
    { id: 'agent-ui', type: 'Agent', title: 'agent-ui', state: 'active', owner: 'system', source: 'agents/ui.md', observed: '14:02Z', detail: 'Renders lenses + region chrome.', rels: ['work-221', 'work-219'] },
    { id: 'agent-core', type: 'Agent', title: 'agent-core', state: 'warning', owner: 'system', source: 'agents/core.md', observed: '14:02Z', detail: 'Queue delay on trace validation.', rels: ['work-205', 'rev-08'] },
    { id: 'mile-03', type: 'Milestone', title: 'V1 localhost cockpit', state: 'verified', owner: 'founder', source: 'docs/strategy/ROADMAP.md', observed: '12:10Z', detail: 'Accepted 2026-06-21.', rels: ['init-009'] },
  ];

  const traces = [
    { status: 'ok', label: 'Audit passed', detail: 'src/regions/inspector.tsx', ts: '14:02:09Z' },
    { status: 'active', label: 'Deploy running', detail: 'init-014 · step 4/7', ts: '14:02:11Z' },
    { status: 'warn', label: 'Queue delay', detail: 'agent-core · routing', ts: '14:02:03Z' },
    { status: 'error', label: 'Validation failed', detail: 'DF-LIVE-ROLLBACK-001', ts: '14:01:55Z' },
    { status: 'ok', label: 'Check passed', detail: 'tokens/typography.css', ts: '14:01:30Z' },
    { status: 'muted', label: 'Awaiting input', detail: 'appr-07 · founder', ts: '14:01:12Z' },
    { status: 'ok', label: 'Parsed governance', detail: 'docs/strategy/ROADMAP.md', ts: '14:00:58Z' },
  ];

  // topology nodes positioned on a normalized 0..100 grid
  const topology = {
    nodes: [
      { id: 'init-009', x: 18, y: 24, state: 'live' },
      { id: 'init-014', x: 50, y: 16, state: 'active' },
      { id: 'work-221', x: 76, y: 30, state: 'active' },
      { id: 'work-205', x: 30, y: 58, state: 'blocked' },
      { id: 'rev-08', x: 54, y: 72, state: 'failed' },
      { id: 'agent-core', x: 78, y: 64, state: 'warning' },
      { id: 'mile-03', x: 16, y: 80, state: 'verified' },
    ],
    edges: [
      ['init-009', 'init-014'], ['init-014', 'work-221'], ['init-009', 'work-205'],
      ['work-205', 'rev-08'], ['rev-08', 'agent-core'], ['init-009', 'mile-03'], ['work-221', 'agent-core'],
    ],
  };

  return { objects, traces, topology, byId: Object.fromEntries(objects.map(o => [o.id, o])) };
})();
