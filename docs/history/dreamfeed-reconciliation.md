# Dreamfeed Reconciliation Traceability Matrix

_Implementation record — 2026-06-22. This matrix governs the internal
Dreamfeed shell only; it does not alter Stakeport public brand surfaces or Gate
C object semantics._

## Authority order applied

1. PS-002, Gate C Parser & Derivation Contract, Gate F UX contract, Brief B
   acceptance feedback, and `CLAUDE.md`.
2. `docs/dreamfeed/` brand, primitive, token, and Verified Node asset guidance.
3. The prior `tools/command-center/` implementation.

## Matrix

| Dreamfeed / reconciliation requirement | Disposition | Implementation evidence | Constraint or rationale |
| --- | --- | --- | --- |
| Preserve the six-object model and Canonical / Derived / Candidate provenance | Retained | Existing `src/state.js`, adapters, and tests remain unchanged | Gate C-fixed semantics; UI registry only projects server output. |
| Preserve source-backed freshness and source evidence | Retained | Existing server state plus Inspector evidence action | No UI field becomes source truth. |
| Preserve all operational modules | Retained | Sidebar maps Overview, OS State Board, Approval Queue, Topology, Roadmap, Milestones, Review, Learning, Sources, Repo Health | No module was removed. |
| Five persistent regions | Rebuilt | `public/index.html`, `public/styles.css` | Sidebar, command bar, canvas, Inspector, and bottom panel are stable desktop regions. |
| Narrow-width access | Rebuilt | Responsive drawer CSS and command-bar toggles | Sidebar and Inspector collapse into controlled drawers below 940px; bottom panel remains accessible. |
| Top command controls | Rebuilt | Search, state filter, explicit lens control, refresh, density, Inspector, and validation controls | Controls are in-memory session state only. |
| Explicit Dashboard / Board / Table / Document / IDE / Topology registry | Rebuilt | `LENS_REGISTRY` in `public/app.js` | Every retained tab maps to a lens; IDE routes source evidence to Inspector. |
| One selected object across graph, cards, and tables | Rebuilt | `buildObjectRegistry`, `selectObject`, keyboard bindings | Stable derived IDs reference existing source-backed records only. |
| Inspector overview, evidence, relationships, read-only actions | Rebuilt | `renderInspector`, `openEvidence` | Replaces the old overlay viewer; reads only through `/api/file` allowlist. |
| Bottom source-backed trace and session feedback | Rebuilt | `renderBottomPanel` | Audit/validation/provenance are labelled source-backed; UI feedback is explicitly ephemeral. |
| Dreamfeed Deep Canvas, planes, hairlines, low-radius panels | Rebuilt | `public/styles.css` plus canonical token routes | Legacy blue/gradient/card-strip styling removed. |
| IBM Plex Sans / Mono and Verified Node mark | Rebuilt | Self-hosted `public/dreamfeed/fonts/`; explicit logo/token routes | No CDN runtime dependency; IBM Plex license retained beside the local font files. |
| Persistent text contrast, focus, reduced motion | Rebuilt | Dreamfeed tokens, focus CSS, reduced-motion media rule | Token text values meet the Dreamfeed 7:1 Deep Canvas rule. |
| Complete topology graph and lists | Retained + rebuilt | Existing topology output; graph now draws every source edge, including offset duplicate paths; node/edge/inventory lists remain | Presentation only; topology data/provenance is unchanged. |
| Graph label clipping | Rebuilt | Fixed-width SVG lanes, label truncation plus Inspector full-title detail | Labels no longer render into a negative SVG coordinate. |
| Repo Health role remains read-only | Retained | Existing `src/repohealth.js`, audit display, tests | `repo-harness-auditor` remains an external read-only workflow; cockpit consumes audit records only. |
| Localhost-only and GET-only transport | Retained + extended | `src/server.js` explicit static asset routes; existing 405 guard | Static Dreamfeed delivery adds no write path or external host. |
| No persistence of cockpit configuration or editor state | Rejected for V1 (UI state) | `public/app.js` uses memory-only `view` state; UI contract test checks browser storage absence | PS-002 FR16 overrides companion-draft Monaco-style persistence guidance. UI state stays non-persistent; the only persisted item is the server-side active-project sidecar (see § Project switching below), not browser/UI state. |
| Multi-project root selection (switch the project folder the cockpit reads) | **Founder-approved (D28, 2026-06-29)** | `src/server.js` `currentRoot` + `/api/project`; `project-config.json` sidecar; `buildState({repoRoot})`; root-aware `repohealth`/`audit`; `public/` project popover; `test/project.test.js` | **Scope addition beyond PS-002 Phase 1, overlapping deferred Phase 1.3, merged in as a PS-002 addendum.** Default unchanged (single Stakeport repo). Five relaxations (sidecar write, state-changing `/api/project` GET, root-rebased containment, restart persistence, one-active-project-per-server) approved under founder decision **D28**; separate from Gate 5b, which remains open. Six-object/provenance semantics unchanged. |
| Execution, overrides, write-back, editing, agent invocation | Deferred / rejected for V1 | No transport routes or controls added | Explicit V1 and Phase 1.2 boundaries. |
| React/CDN design-kit runtime | Rejected | Dependency-free CommonJS server and vanilla client retained | The Dreamfeed UI-kit remains reference material only. |
| Parent Stakeport public brand, website copy, customer claims | Rejected as out of scope | No public brand artifacts changed | Dreamfeed scope is the internal Command Center shell. |

## Project switching (founder-approved — decision D28, 2026-06-29)

A multi-project root-selection capability is implemented and **founder-approved** as a PS-002
addendum. It is a governed scope addition beyond PS-002 Phase 1 (overlapping the deferred Phase
1.3 "workspace-import" path), tracked as decision **D28 (resolved 2026-06-29 — accepted)**, and
**decoupled from Gate 5b** — approval here does not touch 5b, which remains separately open and
still judges the already-submitted Brief B cockpit as it stands.

- **Default is unchanged.** With no switch, the cockpit reads the single Stakeport OS repo
  exactly as before.
- **One active project per server.** All tabs/clients share `currentRoot`; switching repoints
  every surface. Cross-root stale reads are blocked by a `rootToken` carried on `/api/state`,
  `/api/repo-health`, `/api/project`, and required on `/api/file`.
- **Localhost-only and read-only are retained.** No write-back to any project/governance file;
  transport stays GET-only.
- **Constraint relaxations approved under D28 (2026-06-29):** (1) a written cockpit-local `project-config.json`
  sidecar (never a governance/source file; gitignored); (2) a state-changing `/api/project`
  GET; (3) file-viewer containment rebased onto a user-chosen root (realpath + extension +
  `.git`/`node_modules` + size guards retained); (4) selection persisted across restart;
  (5) one active project per server; (6) the native folder picker spawns a local PowerShell
  `FolderBrowserDialog` (fixed script, no request data interpolated, timeout-kills-child);
  (7) a capped/deduped machine-local recent-projects list in the sidecar.
- **Local action guard (CSRF/rebinding defense, not authorization):** state-changing/sensitive
  actions (`/api/project?root=`, `/api/select-folder`) require an in-memory `X-Dreamfeed-Token`
  (never persisted/never a query param) plus a Host-on-actual-port (incl. `[::1]`) + Sec-Fetch +
  optional-Origin guard. The native picker sits behind a provider adapter (`src/projectPicker.js`)
  with `manual` fallback and reserved seams for future breadcrumb/recent/local-agent/remote/cloud
  providers; the single commit path stays `/api/project?root=`.
- **Foreign-project Repo Health** shows live git state only and labels the audit "not
  configured for this project" — the Stakeport audit harness never runs against another repo.

Full rationale + Gate Transition Consistency Audit:
`.claude/plans/2026-06-26-dreamfeed-project-switching.md`.

## Verification links

- Behavioral and UI-contract suite: `npm test` in `tools/command-center`.
- Transport and static asset smoke: `GET /`, state, Repo Health, Verified Node,
  token CSS, and self-hosted font return 200; mutation returns 405; traversal
  returns 400.
- Browser QA: desktop and 390px narrow checks cover five regions, retained
  lenses, drawer controls, selection, Inspector detail, keyboard reachability,
  bottom-panel labels, and graph completeness.
- Source integrity: a combined snapshot of 99 source files is compared after
  the full cockpit session; source hashes and modification times must remain
  unchanged.
