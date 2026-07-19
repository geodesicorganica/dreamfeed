# Vision Execution Plan — from the current build to the full product

**Status:** Draft — decision-ready for founder review, revised 2026-07-12.
This is a planning document, not an accepted decision. Each stage names the
decision records (D38+) that must be grilled and founder-accepted before its
envelope changes are implemented. Authority order: CLAUDE.md and accepted dNN
records override this plan wherever they conflict. Dreamfeed remains separate
from the Stakeport public product and brand; Stakeport appears here only as
customer-zero.

## The destination, stated concretely

The vision docs (strategy.md, persona-icp-model.md) define done as: **a
non-technical founder opens Dreamfeed, onboards their business, staffs a
digital C-Suite of agents that produce real work products under explicit
approvals, and runs the whole operating loop — daily queue, decisions,
shipping — without ever needing an IDE or terminal.** Phase 1.3's gate is two
non-Stakeport businesses doing this; Phase 2's gate is 3+ design partners on a
SaaS spin-out.

## The acceptance ladder (used by every stage)

These are five different states and this plan never conflates them:

1. **Build completion** — code merged, suite green, verification record written.
2. **Founder acceptance** — the founder closes the gate on the record. Never
   self-accepted.
3. **Dogfood evidence** — a defined period of real customer-zero use, with the
   ledger as the measurement instrument.
4. **External validation** — design partners produce the evidence, per the
   acceptance protocol.
5. **Commercial launch readiness** — Phase 2's gate register (security, legal,
   entitlement, pricing) is evidenced.

A stage "exit" below always says which rungs it requires.

## Where we are (post-D37, 2026-07-12)

**Working today (build-complete, gate open):** governed read cockpit over two
schema families; the write lifecycle (intent → plan → approval → execute →
hash-chained ledger); unified onboarding wizard (greenfield + brownfield
import); assistant chat with one-click CLI/preset connect (propose-only);
governed sidecar memory; verification/release evidence records;
topology + discovery + promotion; honest degradation on any local repo.

**Not yet real:** agents that *execute* anything; free-form file edits; a
governed delete; branch/build/deploy surfaces; pause/halt on executions;
per-agent model selection or budgets; remote connectors; encrypted keys;
packaged install; any external user. Traceability rows marked
`reference build` (T08–T26) are all still outside this package.

**Known governance-state contradictions (verified in the live repo, resolved
in Stage 0, not silently decided here):**

- `docs/decisions/d36-*.md` / `d37-*.md` say **"Resolved — founder-accepted
  2026-07-07"** (the grilled fork *decisions*), while
  `docs/history/d36-d37-verification-2026-07-07.md` says **"Founder gate:
  open — not self-accepted"** (the *build*). Two different acceptances share
  one word; the records must say which is which.
- `AGENTS.md:4` still describes the app as **"GET-only, read-only — PS-002
  Phase 1 / Gate F"**, and `docs/product/traceability-matrix.md:15` still says
  "Gate F until a founder-approved execution phase exists" — while CLAUDE.md
  governs the PS-003/Gate G write envelope (D31 *was* that approved phase).
- `docs/product/roadmap.md:57` promises Phase 1.3 **"terminal access"** while
  CLAUDE.md excludes free-form terminal from scope; roadmap line 51 also
  carries a stale "(D36+ candidates)" renumbering from before D36/D37 landed.

## Stage 0 — Close the loop and reconcile the record *(effort: days; evidence: 1 week dogfood)*

> **Progress 2026-07-12:** governance reconciliation and self-adoption **done**;
> customer-zero adoption **deferred by founder choice**; one week of dogfood
> pending. Specifically:
> - D36/D37 **build gate closed** (founder-accepted 2026-07-12); records now
>   distinguish design-accepted (2026-07-07 forks) from build-accepted, so the
>   ambiguity cannot recur. Verification record updated.
> - All seven governance contradictions written through (commit
>   `docs(stage0): close D36/D37 build gate and reconcile Gate F->G`): AGENTS,
>   README, architecture, traceability Gate-F/read-only drift → Gate G;
>   roadmap "D36+ candidates" → D38+; roadmap "terminal access" → named
>   governed operations (terminal position §Terminal encoded).
> - Pending commits **pushed** to origin/main (`283cf8f..09a42ef`).
> - **This repo self-adopted** the `os/` layout via the governed wizard
>   (os-core family; commit `feat(stage0): self-adopt the os/ operating
>   layout`) — **closes D30**. Renders clean; Daily Queue shows the real
>   backlog (T1 = "Grill and record D38"). **Ordering note:** the plan below
>   sequenced stakeport_os first; the founder chose self-adoption first
>   (own-repo-before-customer-zero is safety-first — the original ordering was
>   about exercising the import path, not risk).
> - **stakeport_os adopted** 2026-07-19 (governed os-core scaffold, all 14
>   initiative-derived goals + policy + blockers): `hasNative=true`, 0 parse
>   errors, Daily Queue = 15 Today tasks (7 goals carry real imported
>   work-item tasks; 7 are placeholder stubs the founder fills in). Files left
>   **uncommitted in stakeport_os** for founder review/commit in that repo;
>   control-plane ledgered in the dreamfeed sidecar. stakeport now carries dual
>   representation by design — the Gate-C strategic view (initiatives) and the
>   native execution view (os/goals → Daily Queue) coexist.
> - **Remaining before Stage 1:** founder reviews/commits stakeport's os/ files
>   in that repo; one week of dogfood (elapsed-time evidence, rung 3) with
>   frictions captured as `os/goals/` items. Stage 0 build/setup is otherwise
>   complete.

**Prerequisites:** none — everything here is founder action plus documentation
write-through.

**Scope:**

1. **Live-state consistency audit → founder clarification → canonical
   write-through.** Resolve the three contradictions above explicitly:
   - Founder states whether D36/D37 *builds* are accepted (design acceptance
     via the grill is already recorded); records and verification docs are
     then amended to distinguish **design-accepted** from **build-accepted**
     wording so the ambiguity cannot recur.
   - AGENTS.md and the stale traceability/architecture Gate-F/read-only lines
     are updated to the Gate G reality (a documentation change under existing
     authority — CLAUDE.md already governs; no envelope change).
   - The roadmap's "terminal access" promise is reconciled per the terminal
     position below (§Terminal), as a founder-approved doc update.
   No D38 grill begins until this write-through lands.
2. Push the two pending commits after acceptance (`git-push` is founder-class
   by our own policy).
3. Run the wizard on **stakeport_os** (14 goal drafts are waiting); the Daily
   Queue becomes customer-zero's daily driver.
4. Run the wizard on **this repo** (self-adoption; D30's criterion closes).

**Hard exclusions:** no D38+ implementation; no envelope changes.

**Exit (rungs 1–3):** contradictions written through; both adoptions done; one
week of dogfood with frictions captured as `os/goals/` work items in the
product itself.

## Stage 1 — The operating loop becomes self-sufficient *(build: ~1–2 weeks; evidence: 2 weeks dogfood; calendar: ~3–5 weeks)*

**Prerequisites:** Stage 0 exit.

The cockpit must stop needing VS Code for **routine operating work**. It will
NOT yet replace the IDE for engineering — that is Stage 3's claim.

- **D38 — Governed free-form file edits + governed delete, with a real
  correctness contract.** Make the `work-file-edit` policy class plannable:
  propose-edit intent (operator- or Translator-drafted) → full-diff plan →
  approval → atomic write. The contract D38 must satisfy (each row a red test
  before code):
  - an **absent file is a valid preimage** (create = preimage `null`);
  - **rollback of a create is a governed deletion** (fixes the documented
    "rollback restores empty files" limitation — adding `file-delete` alone
    does not fix it; the rollback path must *use* it);
  - **rollback of a delete restores exact content** (preimage bytes, verified
    by hash);
  - **multi-file plans apply transaction-like**: defined order, halt on first
    failure, and a defined, ledgered recovery path from partial failure
    (roll back applied ops or surface an explicit partial state — never
    silence);
  - symlink/hardlink escape, extension allowlist, size caps, and realpath
    containment protections at least as strict as the current write path.
  `file-delete` defaults founder-class. Envelope: new intent kinds only; no
  new routes.
- **D39 — Async executor: the execution substrate.** Not a convenience —
  Stage 2 agent runs and Stage 3 builds/deploys stand on it. The record must
  define, and tests must pin:
  - the execution **state machine**: `queued → running → (pausing → paused →
    resuming) | (halting → halted) | failed | completed`;
  - **durable progress events** (ledgered or sidecar-journaled) so progress
    survives restarts;
  - **crash recovery**: on process restart, in-flight executions are
    re-adopted or failed deterministically — never lost, never doubled;
  - **single-run ownership** (lease or equivalent) so two executors cannot
    run one plan;
  - **idempotent, safe retry semantics** per op type;
  - **timeout behavior** and **cancellation boundaries** (where a halt can
    and cannot interrupt);
  - **orphaned child-process handling** (spawned work is tracked and reaped).
  Envelope: no new mutating routes; one status GET.
- **D40 — The assistant carries the day.** Streaming replies; the Chief of
  Staff drafts intents directly into the approvals queue (still
  propose-only — the ceiling stays); an on-open "morning brief" (queue +
  blockers + stale decisions digest). **Envelope correction:** streaming is
  *not* "envelope: none." It may reuse the existing route, but it changes
  connection lifetime, abort handling, buffering, backpressure, and error
  behavior — D40 therefore includes an explicit constraints/test amendment
  covering those behaviors, exactly like any other envelope-adjacent change.

**Hard exclusions:** no agent execution; no build/test/deploy commands; no
remote access.

**Exit (rungs 1–3):** two consecutive dogfood weeks in which **operating
coordination, governance and approvals, routine source-backed document work,
and daily queue/ledger use** happen in Dreamfeed with **no direct repository
editing for those workflows** — evidenced by the ledger. Engineering work in
an IDE is expected and out of scope for this exit; complete no-IDE/no-terminal
independence is reserved for Stage 3 and the Phase 1.3 gate.

## Stage 2 — The Digital C-Suite: agents that execute *(build: ~3–4 weeks; evidence: 2 weeks scenario dogfood; calendar: ~5–7 weeks)*

**Prerequisites:** Stage 1 exit; D39 in production use; the Stage-2 security
prerequisites below (§Security) — threat model and redaction — accepted.

The vision's differentiator and the largest deliberate envelope change: the
first crack in the "assistant never executes" ceiling, opened narrowly and
structurally.

- **D41 — Agent runtime v1, with two distinct approvals.** Approving a run
  and accepting its output are different authorities and are never merged:
  1. **Run authorization** (approve-class): permits *this agent* to run with
     a specified provider, resolved context, permission set, and budget.
  2. **Artifact acceptance** (approve-class, separate plan): reviews the
     generated artifacts before they become promoted, source-backed output.
     Generated content never becomes accepted source truth merely because the
     run was approved; unaccepted artifacts remain quarantined run products.
  The Agent Runtime v1 **contract** the record must define:
  - agent-definition schema + version (extends the parsed `AGENT.md` family);
  - skill/context resolution rules (what the agent may read, resolved and
    hashed at plan time);
  - prompt/input/config **hashes bound into the plan** (drift-detected like
    every other plan);
  - provider and CLI **allowlists** (no run against an unlisted endpoint);
  - timeout, retry, and cancellation behavior (delegated to D39 semantics);
  - token/cost accounting per run, with **budget caps that halt**;
  - artifact **type and size limits**; writes land only under
    `agents/<id>/outputs/` with full path/symlink/containment protections;
  - a **run manifest** (inputs, artifacts, costs, events) as the evidence
    record.
  **Scope order:** artifact-producing **research, content, and planning
  agents first. Coding agents remain proposal-only until D44** supplies
  governed build/test verification to check their output against.
- **D42 — Executive Performance Profiles + budgets.** Per-agent
  model/provider selection (the vision's "swap your CTO's brain" moment),
  usage budgets and a spend ledger. Generalizes the D37 config to a keyed
  per-agent store; key custody per §Security.
- **D43 — Boardroom & dispatch UX.** KPI → CoS plan → dispatch board; run
  inspector (manifest, artifacts, cost, evidence); the approvals queue grows
  the ticket-escalation framing from the persona doc.

**Hard exclusions:** no shell access for agents; no writes outside
`agents/<id>/outputs/`; no coding-agent execution; no auto-acceptance of
artifacts.

**Exit (rungs 1–3), behavioral — every scenario demonstrated end-to-end on
real Stakeport work, evidenced by run manifests and the ledger:**

1. successful dispatch → run → artifact → acceptance → promoted output;
2. founder **rejects** an artifact and the revision loop completes;
3. a **runtime failure** recovers per D39 (failed state, safe retry);
4. **budget exhaustion** halts a run cleanly, partial evidence preserved;
5. **halt/resume** mid-run behaves per the state machine;
6. artifact **inspection before promotion** (quarantine is real);
7. all of the above with **no direct IDE or repository intervention**.

## Stage 3 — Full IDE substitution *(build: ~2–3 weeks; evidence: 2 weeks dogfood; calendar: ~4–6 weeks)*

**Prerequisites:** Stage 2 exit; Stage-3 security prerequisites (§Security) —
command-trust model, credential custody, untrusted-repo handling — accepted
**before** D45/D46 implementation.

- **D44 — Branch/commit/build surface.** Branch management UI over the
  existing named git ops; commit composer with staged-diff review; build/test
  as **named, policy-declared commands** (e.g. `npm test`) with captured
  output feeding the verification cockpit. Command trust per §Security: a
  repository's own policy file can *name* commands, but naming is not
  trusting — see the import rule.
- **D45 — Governed deploys.** Named deploy commands (founder-class).
  **Deploy authorization binds to a reviewed commit SHA and a current
  verification record** — a deploy plan for any other tree state is
  unplannable. Evidence wires into the D35 release cockpit so
  `release-mark-shipped` gains a real governed action path.
- **D46 — Remote import v1.** Clone-from-URL into a new local project (the
  wizard's third entry point). **Untrusted-repository rule:** opening or
  importing a repository never auto-executes package scripts, build commands,
  hooks, or repository-supplied tools, and a cloned repo's policy file grants
  no trusted commands until the operator explicitly re-approves each named
  command for that project. Full connector framework (Drive, etc.) stays
  Phase 2 unless design partners force it.

**Hard exclusions:** no free-form terminal (see §Terminal); no auto-trust of
imported configuration; coding agents may now execute **only** with D44
build/test verification in the loop.

**Exit (rungs 1–3):** a non-technical operator goes from remote repo →
onboarded → edited → built → committed → deployed **without leaving the app**,
demonstrated on real work across two dogfood weeks — this is where the
no-IDE/no-terminal claim is finally made, and only here.

## Terminal position (encoded now, reconciled in Stage 0)

The destination explicitly serves operators who should never need a terminal.
Therefore: **governed named operations substitute for terminal access;
free-form terminal is not required for the Phase 1.3 gate** and is not on this
plan's critical path. The roadmap's "terminal access" wording is a
contradiction with CLAUDE.md scope and is reconciled through the Stage 0
founder-approved documentation update — no free-form terminal work is added
merely to preserve stale wording. If a future need is evidenced, it gets its
own decision record.

## Security track (cross-cutting — starts in Stage 2, not Stage 4)

Security work is staged to land **before** the capability that needs it:

- **Before D41 (Stage 2):** threat model for model execution (prompt-injection
  via repo content, exfiltration via context, budget abuse); log/trace/ledger
  **redaction review** (run manifests must never leak prompts' embedded
  secrets); egress audit re-confirmed (adapter remains the only egress).
- **Before D45/D46 (Stage 3):** credential-storage design — "AES-256-GCM" is
  a primitive, not a design; the requirement is **secure key custody,
  preferably the OS credential store** (Windows Credential Manager / Keychain
  / libsecret) or an equivalent platform-backed mechanism, with the
  encrypted-file fallback documented as inferior; **command-trust model**
  (named commands are trusted per-project by explicit operator approval,
  never by repo-supplied files); **untrusted-repository handling** (the D46
  import rule above); deploy authorization bound to reviewed SHA +
  verification record (the D45 rule above).
- **Before Stage 4 partners:** packaged-install hardening review, localhost
  posture re-audit, incident/reporting path in the acceptance protocol.

## Stage 4 — Design partners *(effort: ~2 weeks kit-building; evidence: 4+ weeks per partner; calendar: ~6–10 weeks, partner-bound)*

**Prerequisites:** Stage 3 exit; security track items above accepted; founder
gates for D38–D46 closed.

**Scope:** onboarding kit (D30 issue #2 — packaged install: zero-dep server +
start script, quickstart, acceptance protocol, feedback-capture schema);
recruit **two non-Stakeport businesses**; white-glove onboarding through the
wizard; a 4-week operating cadence each.

**Hard exclusions:** no multi-tenancy, no hosting, no billing — partners run
local instances.

**Exit (rung 4 — this IS the Phase 1.3 gate), measured, per partner:**

- time to first governed artifact (target: first session);
- ≥80% of the partner's target workflows completed **without technical
  assistance** (measured against the acceptance protocol's workflow list);
- approval and failure-recovery flows succeed without support intervention;
- direct-file-edit or terminal **escape count** trending to zero by week 4;
- continued weekly active use through the period (no abandonment);
- zero security incidents or secret exposures;
- structured feedback captured through the acceptance protocol, not anecdote.

Nothing in Stage 5 starts until this evidence exists.

## Stage 5 — Phase 2: the SaaS spin-out *(calendar: quarter+; all estimates TBD at its own discovery)*

**Prerequisites:** Stage 4 exit (rung 4 evidenced).

Grill-me discovery first — this is where the roadmap's own TBDs live: tenancy
model (hosted per-org instances vs. sync layer over local-first),
accounts/roles/provisioning, encrypted secrets service, entitlements/billing,
**legal entity separation from Stakeport**, pricing. The `reference build`
rows (T16–T26) become production work items. Guild/community and
business-blueprint templates follow launch, not precede it.

**Exit (rung 5):** 3+ design-partner orgs plus the security/legal/commercial
evidence per architecture.md's gate register.

## Sequencing rationale (unchanged spine)

- **Customer-zero value at every stage** — each stage ends with Stakeport
  running better, so the plan survives interruption.
- **One bounded envelope change per decision record** — the constraint suite
  grows with each dNN exactly as D31→D37 did; nothing relaxes silently.
- **Agents-execute before IDE-completeness** — the C-Suite is the vision's
  differentiator and the longest pole; git/deploy UX rides on the async
  executor either way; but coding agents wait for D44's verification loop.
- **Partners before platform** — Phase 2 spend is gated on Phase 1.3
  evidence, per the roadmap's own gates.
- **Security lands before the capability that needs it** — never after.

## Standing rules for every stage

Grill-me discovery before each dNN; envelope-first implementation (record +
red constraint tests, then code); `npm test` green at every slice; founder
gates never self-accepted; a verification record per stage in
`docs/history/`; missing inputs stay explicit in the record rather than being
invented.
