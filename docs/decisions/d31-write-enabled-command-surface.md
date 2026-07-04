# D31 — Write-Enabled Command Surface (PS-003 / Gate G)

**Date:** 2026-07-03
**Status:** Resolved — founder-approved 2026-07-03
**Owner:** Founder
**Implements:** Roadmap Phase 1.3 (IDE Substitution), first slice
**Supersedes (in part):** PS-002 Phase 1 / Gate F constraint envelope

## Decision

Dreamfeed Command Center transitions from a read-only cockpit to a
**write-enabled command surface** under a new constraint envelope named
**PS-003 / Gate G**. Writes to the selected project are permitted **only**
through a governed lifecycle — intent → plan → explicit approval → execution →
immutable ledger — ported from the architecture's governed execution lifecycle
(`docs/product/architecture.md` §Governed execution lifecycle).

Founder authorization (2026-07-03, verbatim directive):

> approve the plan for a maximal Fable 5 pass, but require the run to build in
> this order inside the same session:
> 1. Update D31/CLAUDE/workflows/tests to the approved Gate G envelope.
> 2. Add native schema and queue projection.
> 3. Add write engine, approval checks, containment, drift detection, and ledger.
> 4. Add UI for Goals/Operations, approvals, assistant modes, and status bar.
> 5. Add git/workspace readiness and only safe named git actions.
> 6. Run full test suite and produce a final verification report.

## Constraint envelope (Gate G)

### Relaxed by this decision (scoped, not blanket)

| PS-002 / Gate F constraint | Gate G rule |
|---|---|
| GET-only transport | Non-GET methods allowed **only** on the enumerated mutating routes (`/api/intents*`, `/api/plans/*`, `/api/executions/*`, `/api/work/*`, `/api/assistant/*`), each behind the upgraded mutation guard. Every other route/method combination remains 405. |
| Read-only (no source-repo writes) | Writes to the selected project **only** via the governed lifecycle: root-contained, policy-gated, hash-revalidated, ledgered. |
| No server-side persistence beyond `project-config.json` | An app-owned, gitignored, versioned control-plane sidecar (`.dreamfeed/` under APP_ROOT) holds intents, plans, approvals, executions, runs, and the ledger. It is never authority over source truth. |
| No pause/resume/halt/rollback controls | These become the **required** execution controls of the lifecycle (Surgical Overrides + Visual Ledger Confirmation per `command-center-primitives.md`). Traceability T13 flips. |
| No external network calls from the server | Split. **Inbound serving stays loopback-only (hard).** Outbound HTTPS is allowed **only** from the assistant adapter to user-configured model-provider endpoints (the standard IDE-assistant architecture: Cursor / VS Code / Codex class). Keys live in a local gitignored config, never in any repo, never in ledger/traces/logs. |

### Remaining hard constraints (unchanged)

- Localhost-only **serving**: bind 127.0.0.1; host/origin/token guards on every route.
- Workspace isolation: one active project per server; realpath containment;
  `rootToken` binding on every mutation; **no cross-project writes ever**; no
  parent scanning or fallback roots.
- No hidden governance truth written into source repos (control-plane records
  stay in the sidecar).
- Zero runtime dependencies.
- Gate C parser semantics for the existing six object families unchanged — the
  Dreamfeed-native schema is an **additional** adapter family.
- Founder gates are never self-accepted; gate 5b remains open and unaffected.
- Secrets never written to project repos, never present in ledger, traces,
  errors, or exports.

## Grilled forks (discovery per grill-me workflow, resolved by founder 2026-07-03)

1. **Storage:** Goals/Operations/Tasks live as Dreamfeed-native markdown
   (`os/goals/`, `os/operations/`, `os/policy.md`) in the selected project —
   source-backed and git-versioned — with control-plane records (intents,
   approvals, runs, ledger) in the app-owned sidecar. This fulfills the D30
   deferral criterion (parser supports a Dreamfeed-native schema; Issue #1).
2. **Assistant architecture:** the standard IDE-assistant model — local app,
   outbound HTTPS to configured model providers and/or local CLI adapters.
3. **Write scope:** full Phase 1.3 surface approved as direction; **this
   session builds**: native-schema work writes, task transitions, and safe
   named git actions (add/commit/branch/switch policy-classed `approve`; push
   `founder`). Proposed file-edit intents, branch-management UI, deploy
   triggers, and free-form terminal are follow-up batches.
4. **UI shell:** evolve the Gate F five-region shell (navigator sidebar, Queue/
   Work lenses, Inspector ⇄ Assistant right-region toggle, status strip +
   Visual Ledger in the bottom panel). Gate F is reconciled, not discarded.

## Policy classes

Declared in the selected project's `os/policy.md` (app defaults when absent):

- `auto` — ledgered, auto-approved by policy: task-state transitions.
- `approve` — explicit in-UI approval: work-file edits, git add/commit/branch/switch, workflow runs.
- `founder` — explicit approval with typed confirmation: git push, merge, rollback, (future) deploy triggers.
- `denied` — never plannable: force-push, history rewrite, writes outside the active root, `.git/` internals.

## Explicit resolutions of open risks

- **Terminal:** this phase executes **named, policy-declared commands only**;
  the architecture principle "never passes arbitrary text to a shell" stands
  unamended. A free-form terminal requires a future decision (D32 candidate).
- **Provider keys:** stored plaintext in gitignored `assistant-config.json`
  under APP_ROOT — a **known, accepted limitation** for a single-operator
  localhost tool (same exposure class as other IDE-assistant credentials).
  AES-256-GCM key management remains a Phase 2 gate.
- **Chief of Staff ceiling:** the assistant queues intents and drafts
  approvals; it **never approves or executes**. Raising this ceiling requires
  a future decision (D32 candidate).
- **Sprint semantics (placeholder, to confirm):** sprint = `sprint_week`
  frontmatter + task `Scheduled` dates; rollover = incomplete tasks scheduled
  before today.

## Rationale trail

- Plan + evaluation: `.claude/plans/evaluate-this-plan-i-partitioned-tide.md` (session artifact)
- Governed lifecycle source: `docs/product/architecture.md` §Governed execution lifecycle
- Execution-phase UI contract: `docs/product/command-center-primitives.md` §Execution-Enabled Phase
- Native schema spec: `docs/product/native-schema.md`
- Enforcement: `test/constraints.test.js` (Gate G method-policy matrix, write allowlist, egress allowlist, zero-dep), `test/write-guards.test.js`, `test/ledger.test.js`
