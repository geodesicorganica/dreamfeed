# D36 — Unified Onboarding: Interview, Governed Scaffold, Governed Import

**Date:** 2026-07-07
**Status:** Resolved — founder-accepted 2026-07-07 (grill-me discovery, seven forks)
**Owner:** Founder
**Implements:** the "Grill Me" onboarding sprint from the product vision
(`docs/brand/research/persona-icp-model.md` §6–7) as a governed, deterministic
wizard; closes the "no creation path" gap (the only file-creating intent before
this record was `promote-topology`).
**Relation to D31/D32:** extends the Gate G lifecycle with two intent kinds and
two routes; reuses the D32 discovery scanner and the `baseHash: null` create
semantics unchanged. **Relation to D30:** the parser has supported a
Dreamfeed-native schema since D31, so D30's deferral criterion for an `os/`
layer is met; this record supplies the flow that builds one.

## Decision

One **unified onboarding wizard** serves both "Create new project" (greenfield)
and "adopt an existing repo" (brownfield). The flow is always:

pick/create folder → deterministic discovery → show findings → interview the
founder about the gaps → generate the missing artifacts through the governed
lifecycle (intent → plan → explicit approval → execute → ledger).

Greenfield is the case where discovery finds nothing, so every question is a
gap. There is no second flow.

## Grilled forks (resolved by founder, 2026-07-07)

| # | Fork | Resolution |
|---|---|---|
| 1 | Flow shape | One unified wizard; greenfield = empty brownfield |
| 2 | Interview engine | Hybrid: product-authored deterministic question tree drives; configured assistant optionally enriches (conversational probing, drafts document prose); degrades gracefully to templates-only |
| 3 | Scaffold scope | All five artifact families from one interview, per-family opt-out, `os/` core mandatory: (a) strategy/roadmap/brand docs, (b) `os/` goals+operations+policy+blockers+topology, (c) agent definitions (founder / chief-of-staff / domain `AGENT.md`), (d) harness `CLAUDE.md`/`AGENTS.md`, (e) memory scaffolding |
| 4 | Assistant setup | Resolved in D37 (Assistant Connect) |
| 5 | Brownfield | Governed import: discovery proposes draft Goals (initiative tables), Operations (cadence/workflow docs), roadmap phases (roadmap prose) with `matchedBy` evidence; founder edits/confirms; written as real `os/` files via approvals. No heuristic ghost rendering; views keep reading `os/` only |
| 6 | Approval granularity | New `scaffold-project` intent kind; one multi-file plan per artifact family (~5 approvals per onboarding); every file individually diffed and ledgered |
| 7 | Rollout | stakeport_os adopts first (brownfield import), then this repo self-adopts (closes the D30 deferral). Roadmap lens migrates to `os/` as primary source; `CLAUDE.md` "Phase sequencing" becomes a Derived-labeled fallback |

## Product invariants

- **Never a blank canvas.** A project without governance families gets one
  adoption prompt that launches the wizard — not error cards. Missing-file
  ENOENT noise for absent families collapses into that prompt.
- **Explainable generation.** Generation is a pure function of
  `(answers, prefills, acceptedEnrichments, templates)`. Every generated file
  section carries provenance `{file, section, questionIds[]}` in the intent
  payload and plan preview (ledgered). Generated files carry
  `generated_by: dreamfeed-onboarding/v1` frontmatter.
- **The assistant is additive, never load-bearing.** The deterministic
  question text and template prose always stand; enrichment failures or an
  unconfigured assistant never block a step. Accepted assistant drafts enter
  the intent payload so the plan hash binds them.
- **Import is governed, never silent.** Discovery evidence becomes drafts the
  founder edits and approves; nothing renders as truth until it exists as an
  approved `os/` file. Provenance stays honest (D32 tiers unchanged).
- **Merge, never overwrite.** On brownfield repos an existing target file
  (e.g. `CLAUDE.md`) is extended by marker-based section append with a full
  diff in the plan; overwrite is never planned.

## Constraint-envelope impact (Gate G, scoped)

- **New intent kinds:** `scaffold-project` (policy default `approve`),
  `git-init` (policy default `approve`; enables greenfield folders to become
  repos). Both added to policy `DEFAULTS` (unknown ops stay denied).
- **One new mutating route:** `/api/project/create` `['POST']` — validated
  folder creation + project switch for greenfield. With D37's route the exact
  mutating set becomes **nine**; `test/constraints.test.js` is amended once,
  citing D36+D37.
- **One new token-guarded GET:** `/api/onboarding` (questions, families,
  prefills, discovery summary). GET-only, enforced by constraints test.
- **fs-write allowlist** gains `src/onboarding/folders.js` — the only module
  allowed to `mkdir`, restricted to creating one new project directory under
  an existing user-chosen parent (absolute path, name charset check, never
  inside the app root, never a governance write).
- **Executor:** `git-init` is exempted from the `isRepo` gate **by op name
  only** (it is the op that makes a repo); `GIT_SUBCOMMANDS` gains `init`.
- **Documented v1 limitation:** rollback of a create-plan restores empty
  files (the write engine has no governed delete; a delete op is a future
  decision).
- Unchanged: zero runtime dependencies; localhost-only serving; Gate C parser
  semantics for the six Stakeport families; secrets rules; founder gates never
  self-accepted.

## Wizard state

Draft interview answers live in browser `localStorage` keyed by `rootToken`
(resumable across refresh, cleared on completion). The durable record is the
intent payloads and the ledger. Sidecar-resident wizard sessions are
deliberately deferred (would need a new route or store schema bump).

## Implementation plan (slices; `npm test` green at every step)

1. **Envelope** — this record + D37; constraints test amendments (nine-route
   exact set, policy rows, GET-only assertions, allowlist entries); 501 stubs
   for the two new mutating routes so the envelope locks before behavior.
2. **Assistant Connect** (D37 slices).
3. **Engine** — `src/onboarding/questions.js` (deterministic tree as data),
   `src/onboarding/templates/*.md`, `render.js` (substitution + provenance),
   `generate.js` (per-family file sets, merge semantics);
   `planScaffoldProject` in `commands/plans.js` (per-family path allowlists,
   multi-op plan, per-file baseHash + diffs); `git-init` in `planGit` +
   executor; discovery-cache clear on scaffold execution. `test/onboarding.test.js`
   round-trips: scaffold output parses via `buildNativeState`/`loadPolicy`.
4. **Import + API** — `src/onboarding/importers.js` (read-only draft Goals /
   Operations / roadmap from existing state + discovery); GET `/api/onboarding`.
5. **Wizard UI** — `public/wizard.js` pure tree walker (node-tested);
   wizard dialog in `app.js` (findings → interview → per-family review with
   diffs + provenance → sequential approvals via the existing dialog);
   `/api/project/create`; entry points (project picker "New project",
   Overview banner, Daily/Roadmap empty states; ENOENT cards collapse).
6. **Roadmap source migration** — goals' Phase rows primary; CLAUDE.md
   fallback labeled Derived.
7. **Rollout + verification** — stakeport_os import, then self-adoption;
   verification record in `docs/history/`. **Founder gate — never
   self-accepted.**
