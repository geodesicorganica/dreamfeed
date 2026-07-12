# D36 + D37 Verification Record — 2026-07-07

Self-verification of the Unified Onboarding (D36) and Assistant Connect (D37)
builds. **Founder gate: open — not self-accepted.**

## What was built

- **D36** — one onboarding wizard for greenfield and brownfield:
  `src/onboarding/` (questions.js deterministic tree, render.js provenance
  renderer, templates/, generate.js per-family generator with merge-never-
  overwrite semantics, importers.js governed-import drafts, folders.js the
  sole mkdir module), `scaffold-project` + `git-init` intent kinds in
  `commands/plans.js`/`executor.js`, GET `/api/onboarding`, POST
  `/api/project/create`, `public/wizard.js` pure walker, wizard dialog + entry
  points in `public/app.js` (Daily Queue / Overview null states, Board
  ENOENT-collapse, project-picker "New project here"), roadmap lens primary
  source migrated to `os/goals` Phase rows (CLAUDE.md prose stays as fallback).
- **D37** — first-run "Connect your assistant": `src/assistant/probe.js`
  (fixed-table CLI detection + Ollama), `presets.json` (constraint-tested
  endpoint data), managed `assistant-config.json` via POST
  `/api/assistant/config` (key-free ledger event, redacted descriptors),
  `onboarding` assistant mode, connect/settings dialog in the UI, per-format
  HTTP bodies (the Anthropic preset now sends a valid Messages-API request).

## Envelope changes (all decision-cited in test/constraints.test.js)

- Mutating exact-set: the D31 seven + `/api/assistant/config` +
  `/api/project/create` = **nine**.
- Policy DEFAULTS: `scaffold-project` approve, `git-init` approve.
- fs-write allowlist: + `onboarding/folders.js`; + line-scoped `CONFIG_FILE`
  exemption in `assistant/adapter.js` (mirrors `PROJECT_CONFIG_FILE`).
- New GETs `/api/onboarding`, `/api/assistant/probe`, `/api/assistant/config`
  — guarded, GET-only-tested.
- Preset-endpoint exemption: constraints test parses `presets.json` and pins
  hosts ⊆ {api.anthropic.com, api.openai.com, localhost, 127.0.0.1}.
- UI contract amendment: `localStorage` allowed ONLY via the wizard draft
  helpers (`wzDraftKey`); the action token still never touches storage.
- Executor: `git-init` exempted from the isRepo gate by op name only; init on
  an existing repo is refused (`state`).

## Evidence

- `npm test`: **172 tests, 171 pass, 1 env skip, 0 fail** (was 134 before the
  build; +38: constraints amendments, assistant-config 9, onboarding 11,
  onboarding-import 6, wizard 6, native-roadmap 1, ui-contract 2).
- `node test/run-integration.js` against `c:\Projects\stakeport_os`:
  **22/22 pass**.
- **Greenfield end-to-end drive** (scripted HTTP against a live server — the
  exact wizard call sequence): create folder → onboarding descriptor (19
  questions) → five scaffold-project lifecycles (17 files, per-family
  approvals) → git-init → **Daily Queue 2 today · Work Detail clean ·
  Roadmap from os/goals · Milestones derived · Topology shows agents+docs ·
  discovery 10 candidates · ledger chain OK (49 events)** → assistant
  connect/clear round-trip redacted → re-run refuses with "already exists —
  skipped" for every file. All 40 steps PASS.
- **Round-trip invariant** (test-pinned): generated os/ files parse with zero
  errors through `buildNativeState`/`loadPolicy`/`readManifest`/
  `buildTopology`, and the day-one queue is non-empty.
- **Brownfield import** (test-pinned + live): stakeport_os yields 14 goal
  drafts (initiative tables, with linked work items as tasks), 4 roadmap
  phases, evidence lines on every prefill; the generic-governance fixture
  round-trips imports → os/ files → clean parse.

## Known limitations (documented in D36/D37)

- Rollback of a create-plan restores empty files (no governed delete op yet).
- Wizard drafts live in browser localStorage (lost with the profile); the
  durable record is intent payloads + ledger.
- CLI probe reports "found" for an installed-but-unauthenticated CLI; the
  first real call surfaces the auth failure.
- OAuth device-flow deferred; keys remain plaintext in the gitignored config
  (accepted D31 limitation; AES-256-GCM is a Phase 2 gate).

## Addendum — universal-repo hardening pass (2026-07-12)

Every folder under `C:\Projects` (Next.js app with a space in its name,
Firebase app, plain container folder, archive dump, both governance repos) was
driven through all read surfaces. No surface threw anywhere. Six defects found
and fixed, pinned by `test/universal-repo.test.js`:

1. Absent Stakeport family reported 11 parse errors on every generic repo →
   absent family is now a flag (`state.stakeportFamilyPresent`), zero errors;
   a PARTIAL family still reports missing files loudly. Board shows one
   adoption prompt instead of an error wall.
2. Roadmap absence (no CLAUDE.md / no "Phase sequencing") errored → now quiet
   (os/goals is the primary source per D36); a present-but-unparseable
   section still errors.
3. Discovery walked build output (`.next` = 868 wasted entries) → ignore set
   extended (.next/.nuxt/.svelte-kit/out/target/coverage/vendor/.venv/venv/
   __pycache__/.gradle/.idea/.cache/tmp). Bomber Beta scan: 626ms → 82ms.
4. `Docs/*.md` missed the document rule (case-sensitive match) → any-case.
5. Binaries matched as candidates (`management_agent.dll` via agentic-filename;
   any file under `tools/` via skill-dir) → name/skill matching now limited to
   authored text extensions.
6. Generic repos had no interview prefills → `package.json` description
   prefills the one-liner (folder name deliberately kept over often-boilerplate
   package names).

Post-fix probe: all six roots load with parseErr=0 (stakeport_os keeps its 14
initiatives / 4 phases), suite 177 tests / 0 fail, integration 22/22.

## Rollout status (D36 fork 7)

stakeport_os brownfield import first, then dreamfeed self-adoption (closing
the D30 deferral) — **both are founder-driven wizard runs, not performed in
this build session**. The importers were validated read-only against
stakeport_os; no project repo was written.
