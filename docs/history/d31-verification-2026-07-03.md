# D31 Gate G build — self-verification record (2026-07-03)

**Status: self-verified — awaiting founder review.** Per the verification
workflow, this record documents evidence only; the founder makes the final
call. Nothing here accepts a gate.

## What was built (founder-directed order, six scoped commits)

1. **Governance layer** — D31 decision record (PS-003 / Gate G envelope),
   CLAUDE.md + workflow constraint rewrites, `native-schema.md` spec,
   Gate G `constraints.test.js` parameterized by the server's exported
   `MUTATING_ROUTES` table.
2. **Native schema + queue** — `src/nativeSchema.js` (Goal→Phase→Milestone→Task,
   Operation→Workflow→Task, blockers; full Gate C provenance discipline),
   `src/queue.js` (daily projection + sprint metrics), fixture, GET routes
   `/api/queue|work|sprint`.
3. **Write engine** — `src/write.js` (single containment-checked write path),
   `src/commands/` (store, hash-chained ledger, policy classes, pure plan
   computation with LCS diff previews and planHash binding, serial executor
   with drift re-checks, founder typed confirmation, divergence-refusing
   rollback), guarded POST lifecycle routes. Mid-flight pause/resume/halt are
   deferred (synchronous single-op executor cannot service them — D32).
4. **UI** — Goals/Operations navigator, Daily Queue landing lens + Work Detail,
   approval dialog with diff preview, Inspector ⇄ Assistant dock (Chief of
   Staff / Translator / Chat over `src/assistant/adapter.js`), bottom status
   strip + Pending approvals + Visual Ledger with rollback.
5. **Git readiness + named actions** — `repohealth.writeReadiness` per-op
   verdicts; Stage/Commit/Branch/Switch/Push buttons raising governed intents;
   push is founder-class.
6. **This verification pass** — doc flips (traceability T03/T10/T12/T13/T30,
   roadmap Phase 1.3 status, architecture gate register, README, security
   runbook) and full-suite runs.

## Test evidence

| Suite | Result |
|---|---|
| Portable (`npm test`) | **87 tests: 86 pass, 1 legacy skip, 0 fail** |
| Stakeport integration (`npm run test:integration`) | **22 pass, 0 fail** |

Constraint-critical suites within the portable run:

- `constraints.test.js` (6) — method-policy matrix (non-GET 405 everywhere
  except the enumerated lifecycle routes; unguarded lifecycle POSTs 403;
  undeclared methods 405), fs-write allowlist (only `write.js`, sidecar
  store/ledger, project sidecar line), no source-literal external origins,
  zero-dep, denied-class static guard (no force/history-rewrite git anywhere).
- `write-guards.test.js` (11) — containment (traversal, absolute, `.git/`,
  extension), file-layer drift refusal, policy denial, **auto** end-to-end
  transition with full ledger trail, **drift 409 between approval and
  execution**, **approve-class refusal before explicit approval**, **founder
  typed confirmation**, rollback (restore, re-rollback refusal, divergence
  refusal), transport rejections (415 content type, 405 method, malformed
  percent-escape), cross-project intent isolation, escaped-pipe round-trip.
- `ledger.test.js` (4) — hash chain, paging, tamper detection, no silent
  re-chaining after tampering.
- `readiness.test.js` (2) — per-op git verdicts over real temp repos.
- `native-schema.test.js` (7) — hierarchy fidelity, tiering, evidence
  resolution, queue projection/ordering, sprint metrics, degradation.
- `ui-contract.test.js` (8) — five regions preserved, Queue lens registry,
  Gate G surfaces (navigator, approval dialog, assistant modes, status strip,
  named git actions), token never in query/storage.
- `project.test.js` (22) — workspace isolation unchanged and green.

## Acceptance rituals (all automated, all passing)

- An **unapproved** execution is refused (409) and the refusal path is covered
  at unit + HTTP layers.
- A **drifted** plan (source edited after approval) is refused (409, code
  `drift`); the file is untouched.
- An **out-of-root / traversal / `.git`** write is structurally unreachable
  (containment errors at the write layer before any policy question).
- A **forged ledger event** breaks `verifyChain()` permanently — appends do
  not silently re-chain.
- A **founder-class** operation (push, rollback) cannot be approved without
  typing the exact record id.

## Constraint checklist walkthrough (verification-workflow.md)

- [x] Loopback serving — bind unchanged; guards on every route; assistant
      adapter is the only egress module and takes endpoints from config only.
- [x] Method policy — enforced behaviorally by `constraints.test.js`.
- [x] Governed writes — single write path; no direct-write route exists.
- [x] Containment — mirrored from `readRepoFile`, plus write-only rules.
- [x] Drift detection — planHash binding + re-checks at approve and execute.
- [x] Ledger — append-only, hash-chained, verified, surfaced in UI.
- [x] Policy — unknown operations denied; projects can re-class, not invent.
- [x] Six-object model — untouched (integration suite green against Stakeport).
- [x] Three-tier provenance — native schema uses the same field/nys discipline.
- [x] Self-hosted assets / zero-dep — unchanged, tested.

## Explicitly NOT built (remain gated; D32 candidates)

Free-form file editing intents, branch-management UI beyond create/switch,
deploy triggers, free-form terminal, assistant execution authority, provider
key encryption (Phase 2 gate), tenant scoping of the sidecar (Phase 2).

## Known limitations recorded in D31

Plaintext local `assistant-config.json` keys; sprint semantics are the D31
placeholder (sprint_week + scheduled dates) pending confirmation; ledger
tampering is detectable, not preventable, on a single-operator machine.
