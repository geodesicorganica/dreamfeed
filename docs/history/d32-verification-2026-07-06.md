# D32 adoption-bridge build — self-verification record (2026-07-06)

**Status: self-verified — awaiting founder review.** Per the verification
workflow, this record documents evidence only; the founder makes the final
call. Nothing here accepts a gate.

## What was built (D32 plan order, six steps, one session)

1. **Envelope** — D32 flipped to Resolved; `constraints.test.js` gained three
   D32 assertions: the mutating-route table is **exactly the D31 seven**
   (promotion adds an intent kind, never a route), `promote-topology` is
   policy-classed `approve` in the defaults, and `/api/discovery` exists
   GET-only.
2. **Layout orchestrator** — `public/layout.js` (pure, deterministic,
   node-testable): invariant human root (`human:operator`, runtime
   provenance), anchor cascade (declared human → reports-to sink → max flow
   reachability over **agentic** candidates → lexicographic; explicit
   `anchorId` for discovery mode), data-flow normalization (`consumes-from`
   and `reads` reversed for layering/loops, declared direction preserved for
   arrowheads), BFS layers + any-direction neighbor attachment (no node ever
   dropped), loop detection (capped, canonicalized), three strategies with
   disclosed auto-selection and warn-and-fallback override. Fixtures:
   stakeport snapshot, empty, no-reports-chain, declared-human.
3. **Renderer swap** — `graphLayout()` in `app.js` delegates geometry to the
   orchestrator; human glyph ("You", gold double circle); dashed gold runtime
   edge to the anchor (excluded from the source-edge tally); toolbar with
   strategy/why/root/anchor disclosure + session-only override (Auto | Layered
   | Radial | Clustered) + candidates toggle + rescan; loop list with
   select-to-highlight reusing the hot/dim grammar; `/layout.js` STATIC route
   + script tag; ui-contract regexes updated preserving intent.
4. **Discovery + adapter** — `src/discovery.js`: role-based deterministic
   scanner (agent/skill/workflow/document/code-surface/memory signals;
   bounded 4 KB markdown sniff for frontmatter/headings; ignore-set
   `.git node_modules dist build .dreamfeed`; depth 6 / 8000-entry caps with
   warnings; per-kind cap 40 with rollup of the remainder; unmatched files
   roll up per top-level dir). GET `/api/discovery` (cached per root,
   `?rescan=1`). `src/topology.js` reads the promoted `os/topology.md`
   manifest (table-based — flat-YAML frontmatter cannot express node lists;
   `os/policy.md` parser precedent) as an additional adapter family; promoted
   objects parse **Canonical**. Schema documented in
   `docs/product/native-schema.md`.
5. **Promotion** — `promote-topology` intent kind in `plans.js`:
   validates kinds/types against the manifest sets, create-or-merge with
   row dedupe, hash-binds to the existing manifest (`baseHash: null` = must
   not exist — the D31 `write.js`/`checkDrift` null semantics already
   implement create; verified, not reimplemented). Policy default `approve`.
   UI: Promote… button on discovered rows → intent → plan → the same approval
   dialog as every other write → execute → ledger.
6. **This verification pass** — full suites + live end-to-end drive below.

## Test evidence

| Suite | Result |
|---|---|
| Portable (`npm test`) | **116 tests: 115 pass, 1 pre-existing env skip (symlink), 0 fail** |
| Stakeport integration (`npm run test:integration`) | **22 pass, 0 fail** |

New/extended suites: `layout.test.js` (11 — invariants, cascade, normalization,
no-node-dropped, strategies, override fallback, determinism, input purity),
`discovery.test.js` (7 — rule hits with matchedBy evidence, rollups,
determinism, empty project, manifest Canonical parse, buildTopology merge,
unknown-kind rejection), `write-guards.test.js` +3 (full HTTP lifecycle create,
merge + drift 409 + replan, validation), `constraints.test.js` +3,
`ui-contract.test.js` D32 contract test.

## Live end-to-end drive (server + orchestrator, no DOM)

- Static surface: `/`, `/layout.js`, `/app.js`, `/styles.css` all 200 with
  correct content types.
- **stakeport_os** (formal topology): root `human:operator`, anchor `founder`
  via reports-to-sink, 51/51 nodes placed, strategy `layered`; overrides to
  layered/radial honored; clustered-loops override falls back **with
  warning** (0 loops); hybrid discovery adds 95 candidates + 11 rollups
  behind the toggle.
- **dreamfeed-command-center** (no formal topology → adoption bridge): 85
  candidates (5 agent, 35 skill, 2 workflow, 40 document, 2 code-surface,
  1 memory) + 11 rollups; bridge map Human → discovered project → 96
  children, 98/98 placed.
- Discovery cache: ~5 ms cached vs ~81 ms rescan.
- Promotion (from the write-guards HTTP suite): intent → approve-class plan
  with null baseHash → approve → execute → `os/topology.md` created with
  promoted rows → ledger `op-applied` entry; external edit between plan and
  execute → **409 drift**; replan merges and preserves prior promoted rows.

## Findings for founder attention

1. **Stakeport has 0 flow loops under data-flow normalization.** The D31-era
   counter-directional `consumes-from` cycles disappear once edges are
   normalized (dispatch and consume now point the same way). Loops appear only
   when a produced artifact is read back upstream — stakeport's frontmatter
   declares no such chain today. The loop panel says so honestly. If the
   operating-loop story (dispatch down / report back) should render as loops,
   the cleanest fix is declaring the read-back edges in frontmatter, or a
   future decision to include `reports-to` in loop detection (D33 candidate).
2. **Documents cap hit on this repo** (40-per-kind): the remainder rolls up
   with a warning rather than disappearing — working as designed, disclosed.
3. **Manifest format refinement**: tables instead of the D32 sketch's nested
   YAML (the Gate C frontmatter subset is flat); recorded in
   `native-schema.md` and the D32 record's implementation plan was followed
   otherwise.

## Addendum (2026-07-06, founder-directed): project-agnosticity + scale pass

Founder direction: stakeport_os is one example, not the target — the cockpit
must hold for any local folder. Audit + fixes:

- **Agnosticity audit**: `layout.js`, `discovery.js`, and the promotion path
  contain zero stakeport-specific rules (grep-verified). Remaining "founder" /
  "strategic" hits are the policy-class vocabulary and the Gate C Stakeport
  *adapter family* — one adapter among several, degrade-safe elsewhere. Fixed
  a stale `server.js` comment claiming a Stakeport default root (the code
  defaults to `null` — no project assumed); the comment now also records that
  remote (GitHub) repos must be cloned locally, since non-assistant egress is
  outside the Gate G envelope.
- **Canvas grows, never clips**: layered/radial/clustered widths were bounded
  by the fixed 1220 px canvas — a >9-layer graph clipped. The orchestrator now
  computes required width (1220 as minimum); the renderer consumes
  `spec.constraints.canvasWidth`. Stress test: 300-node chain → 301 layers,
  every node inside the widened canvas.
- **Loop detection work budget**: exhaustive path enumeration is exponential
  on dense graphs; a 150k-step budget guarantees termination on any project
  and warns when the loop list may be incomplete. Stress test: 60 nodes ×
  12 out-edges each (720 edges) terminates with capped, disclosed results.
- **Ecosystem-agnostic discovery**: workflow signals extended beyond npm —
  pyproject.toml/requirements.txt/setup.py, Cargo.toml, go.mod,
  pom.xml/build.gradle, Gemfile, composer.json, Dockerfile/compose. Fixture
  test covers go.mod + pyproject.toml.

Post-addendum evidence: **120 portable tests, 119 pass, 1 env skip, 0 fail**;
integration 22/22.

Founder gate: **open — not self-accepted.**
