# D32 — Human-Rooted Topology, Discovery, and Promotion (Adoption Bridge)

**Date:** 2026-07-06
**Status:** Resolved — founder-accepted 2026-07-06 (Canonical tier for promoted objects confirmed)
**Owner:** Founder
**Implements:** Topology lens evolution (replaces the fixed 3-column `graphLayout()`); first slice of project adoption
**Relation to D31:** stays inside the Gate G envelope. Adds **one intent kind** and **one read-only GET route**; adds **no mutating routes**. The D31 "D32 candidates" (free-form terminal, async executor, assistant-approval ceiling) are **not** addressed here and renumber to D33+ candidates.

## Decision

The Topology lens becomes a **human-rooted, project-adaptive map and adoption
bridge**. Three parts, shipped in one build (founder-chosen sequencing):

1. **Layout** — a deterministic layout orchestrator (layered / radial /
   clustered-loops) replaces the fixed 3-column layout. The human is always
   the root of the map.
2. **Discovery** — a provider-agnostic, deterministic scanner renders a
   candidate map for repos without (or with partial) formal topology.
3. **Promotion** — the human promotes discovered candidates into durable
   topology via the governed write lifecycle, landing in `os/topology.md`.

## Product invariants

- **The human is always the root.** `rootNodeId: "human:operator"`,
  `rootProvenance: "runtime"` — a product-level node, never a fallback, never
  displaced by a repo object. The surrogate cascade selects only the
  **anchor**: the first source-backed node under the human
  (`human` kind if a repo ever declares one → `reports-to` sink → max flow
  reachability → lexicographic). Root and anchor are separate spec fields with
  separate provenance.
- **Never silently show nothing.** Formal topology → render it. No formal
  topology but project content → render the discovered candidate map. Truly
  empty → human node + adoption guidance. "No formal topology" is not an
  empty graph; "no project content" is.
- **Every automatic choice explains itself.** Legend discloses strategy, root,
  anchor rule, and a concrete why ("layered · 50 nodes · anchor: founder via
  reports-to sink"). Discovered nodes carry `matchedBy[]` evidence.
- **Override is presentation-only.** Strategy override (Auto | Layered |
  Radial | Clustered) is session view-state; it never writes to any repo and
  never changes topology truth. If a forced strategy cannot cleanly render,
  warn and fall back.
- **Provenance stays honest.** Four tiers on one map: `source-backed`
  (declared by governance/topology files), `discovered` (deterministic scan),
  `candidate` (inferred relationship awaiting confirmation), `unmapped`
  (exists, unconnected — folder rollups only, never per-file node spam).
- **Durable truth lives in the source repo.** Promotions write
  `os/topology.md`. The `.dreamfeed/` sidecar holds **pending candidates
  only** (pre-approval workflow state) — never durable topology.
- **No model-assisted discovery in v1.** Path, filename, frontmatter, JSON/
  YAML keys, headings, and first-page titles only: deterministic and
  explainable.

## Layout semantics

- **Data-flow normalization.** Before layering/loop detection, `consumes-from`
  and `reads` edges are reversed so every flow edge means "work product
  travels this way". Layers = how far output travels from the human's
  dispatch; produce → read → dispatch cycles surface as real loops.
  Arrowheads still render the frontmatter's declared direction.
- **Edge classes.** Flow: `dispatches-to`, `consumes-from`, `reads`,
  `produces`. Structure: `owns`, `reports-to`, `depends-on`.
- **Placement.** BFS layers from the anchor over normalized flow edges; any
  unplaced node attaches to an already-placed neighbor in either direction
  (forward → one layer deeper, reverse → one shallower, floored at 1). No node
  is ever dropped from the canvas.
- **Strategy auto-selection.** clustered-loops when loops dominate; radial for
  small graphs (≤40 nodes, ≤4 layers, ≤2 loops); layered otherwise —
  disclosed and overridable per the invariants above.
- **Loops.** Detail panel lists detected loops with weight
  (primary/secondary); selecting one highlights its full edge path using the
  existing hot/dim selection grammar.

## Grilled forks (resolved by founder, 2026-07-06)

| # | Fork | Resolution |
|---|---|---|
| 1 | Strategy scope | Full spec: all three strategies |
| 2 | Code home | New `public/layout.js`, node-testable (`module.exports` guard); one STATIC route + script tag |
| 3 | Root | Human is invariant root (runtime provenance); cascade picks the anchor only |
| 4 | Empty graph | Human + discovered inventory + adoption guidance; never a blank canvas |
| 5 | Sequencing | Layout + discovery + promotion in one build (this record) |
| 6 | Promotion target | `os/topology.md` manifest; sidecar for pending candidates; `agents/` scaffolding deferred |
| 7 | Discovery heuristics | Provider-agnostic deterministic ruleset + rollups + explainable confidence (`matchedBy`) |
| 8 | Edge direction | Normalize to data-flow (reverse `consumes-from`, `reads`) |
| 9 | Loop rendering | Loop list + select-to-highlight |
| 10 | Strategy UX | Disclose + session-only manual override with warn-and-fallback |
| 11 | Discovery coexistence | Hybrid: discovery always runs (cached, explicit rescan); candidates render beside formal topology behind a legend toggle |

Accepted defaults: human node label "You" with a distinct glyph; scanner
ignore-set `.git, node_modules, dist, build, .dreamfeed`; metadata sniffing
capped at 4 KB per file.

## Constraint-envelope impact (Gate G, scoped)

- **No new mutating routes.** `promote-topology` is a new intent **kind**
  flowing through the existing enumerated lifecycle routes
  (`/api/intents*` → plan → approve → execute → ledger). Policy class
  default: `approve` (overridable in `os/policy.md`).
- **One new read-only GET route** (`/api/discovery`): loopback/host/origin/
  token-guarded like every route, realpath-contained to the active root, no
  parent scanning, ignore-set + bounded reads (4 KB sniff) + entry caps with
  rollups.
- **Write engine gains create-file semantics.** `checkDrift()` and the
  executor treat `baseHash: null` as "file must not exist at execution"
  (drift = file appeared). Existing-file semantics unchanged.
- Unchanged: zero runtime dependencies; Gate C parser semantics for the six
  Stakeport families (the `os/topology.md` reader is an **additional** adapter
  family, per the D31 precedent); localhost-only serving; secrets rules;
  founder gates never self-accepted.
- `test/constraints.test.js` extends to enforce: the mutating-route set is
  **unchanged**, `promote-topology` appears in the policy defaults, and
  `/api/discovery` is GET-only.

## `os/topology.md` manifest (promotion target)

One frontmatter-structured markdown file declaring promoted nodes and edges:

```markdown
---
schema: dreamfeed-topology/v1
nodes:
  - id: planner
    kind: agent
    name: Planner
    promoted_from: "src/agents/planner.md"
    matched_by: ["path:agents", "heading:Agent"]
edges:
  - from: planner
    to: docs/PLAN.md
    type: produces
---
```

Promoted objects parse as tier `Canonical` with
`source_evidence: os/topology.md` (source-backed by definition — the file is
git-versioned project truth). Full schema lands in
`docs/product/native-schema.md` during step 4 below.

## Discovery ruleset v1 (role-based, not vendor-based)

| Signal | Candidate kind | Confidence |
|---|---|---|
| `agents/`, `agent/`, `.agents/`, `ai/agents/`; files named agent/assistant/operator/planner/reviewer/orchestrator | agent | high (dir) / medium (name) |
| `skills/`, `tools/`, `prompts/`, `playbooks/` | skill | high |
| `AGENTS.md`, `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `docs/**/*.md`, `.cursor/rules`, Codex/Claude/Cursor/Windsurf-style configs | document | high |
| `.github/workflows/`, package scripts, Makefiles, task runners, CI configs | workflow | high |
| `src/`, `app/`, `server/`, `public/`, `scripts/`, `packages/` (one node per top-level dir) | code surface | high |
| `memory/`, `context/`, `knowledge/`, `notes/` | memory/context | medium |
| frontmatter keys (`agent_id`, `skill_id`, `owns`, `reports_to`, `role`), headings, first-page titles | per matched role | medium/low |
| everything else | unmapped rollups with counts | — |

Every discovered node carries
`{ provenance: "discovered", confidence, matchedBy: [...], sourcePath }`.

## Implementation plan (build order, one session, tests green at every step)

1. **Envelope first.** Land this record; add the D32 row to `decisions.md`;
   extend `test/constraints.test.js` (unchanged mutating-route set,
   `promote-topology` policy row, `/api/discovery` GET-only) — red until the
   later steps make them pass where applicable.
   *Exit:* docs merged; new constraint assertions written.
2. **Layout module.** `public/layout.js`: `orchestrate(graph, options) →
   layoutSpec` with root/anchor fields, data-flow normalization, BFS +
   neighbor attachment, three strategies, loop detection, fan-offset hints,
   warnings — pure, deterministic, `module.exports` guard. Fixtures in
   `test/fixtures/topology/` (stakeport snapshot, empty, no-reports-chain,
   human-node) ported from the session dry run. New `test/layout.test.js`:
   cascade order, normalization, no-node-dropped, strategy thresholds,
   determinism (two runs, identical spec).
   *Exit:* layout tests pass in node with zero DOM.
3. **Renderer swap.** `app.js`: `graphLayout()` consumes `layout.js`; human
   "You" glyph; legend disclosure line + strategy override control
   (session view-state only); loop list + select-to-highlight; provenance-tier
   styles; `/layout.js` STATIC route + `index.html` script tag. Update
   `test/ui-contract.test.js` regexes to the new module while preserving
   intent (kind normalization, synthetic-endpoint registration order,
   all-edges-drawn).
   *Exit:* `npm test` green; visual QA of stakeport_os in all three strategies
   via override.
4. **Discovery + adapter.** `src/discovery.js` (ruleset above; caps, ignores,
   bounded reads; per-project session cache + rescan) behind GET
   `/api/discovery`; `src/topology.js` gains the `os/topology.md` reader as an
   additional family; manifest schema documented in
   `docs/product/native-schema.md`. Fixture repos in
   `test/fixtures/discovery/` (unadopted, half-adopted, empty); new
   `test/discovery.test.js` (rule hits, matchedBy evidence, rollup caps,
   containment).
   *Exit:* dreamfeed-command-center itself renders a candidate map; stakeport
   renders hybrid with the toggle.
5. **Promotion.** `promote-topology` intent kind in `plans.js`
   (create-or-update `os/topology.md`; `baseHash: null` create semantics in
   `checkDrift()`/executor); policy default `approve`; pending-candidate
   records in the sidecar; promote action in the inspector for
   discovered/candidate nodes → existing approvals flow → ledger. Extend
   `test/write-guards.test.js` + `test/ledger.test.js`.
   *Exit:* end-to-end promote on a fixture repo: intent → approval → manifest
   written → rescan shows the node as source-backed.
6. **Verification.** Full suite; drive the real flow per the verification
   workflow (all four project shapes); write the verification record.
   **Founder gate — not self-accepted.**

## Rationale trail

- Grill-me session 2026-07-06 (11 forks, this session) per
  `docs/workflows/grill-me-discovery.md`
- Layout dry runs against stakeport_os / dreamfeed / synthetic graphs
  (session scratchpad `layout-orchestrator.js`, `spec-*.json`) — evidence for
  the cascade, attachment pass, and strategy thresholds
- Layout spec origin: founder-supplied "Repo-Driven Topology Layout
  Orchestrator" template, amended by dry-run findings (no `human` kind in
  Gate C output; skills unreachable via as-declared flow edges;
  `consumes-from` direction)
- Write-lifecycle base: `docs/decisions/d31-write-enabled-command-surface.md`
- Enforcement: `test/constraints.test.js`, `test/layout.test.js` (new),
  `test/discovery.test.js` (new), `test/write-guards.test.js`,
  `test/ui-contract.test.js`
