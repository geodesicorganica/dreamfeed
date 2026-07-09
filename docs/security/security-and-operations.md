# Security, retention, incident, and readiness runbook

## Gate G addendum (D31, 2026-07-03)

- **Control-plane sidecar.** Lifecycle records (intents, plans, approvals,
  executions) and the append-only hash-chained ledger persist in the
  app-owned, gitignored `.dreamfeed/` directory with a `schemaVersion` field.
  It is never authority over source truth; deleting it loses lifecycle
  history, not work data. Tenant scoping remains a Phase 2 requirement.
- **Assistant egress and keys.** `src/assistant/adapter.js` is the only module
  with outbound egress, and only to endpoints the operator configured in the
  gitignored `assistant-config.json`. Provider keys live in that file in
  plaintext — a **known, accepted D31 limitation** for a single-operator
  localhost tool (same exposure class as other IDE-assistant credential
  stores). Keys are never logged, ledgered, echoed in errors, or exported.
  AES-256-GCM key management remains a Phase 2 gate.
- **Ledger integrity.** `verifyChain()` recomputes every event hash and prev
  link; the UI surfaces LEDGER OK/BROKEN in the status strip. Tampering is
  detectable, not preventable, at this trust level (single-operator machine).

## Governed memory addendum (D33, 2026-07-07)

- **Memory sidecar.** Approved memories persist in `.dreamfeed/records.json`
  schema v2 beside lifecycle records. They are contextual aids, never source
  truth, and every write goes through the governed lifecycle.
- **Secret exclusion.** Memory validation rejects likely credentials before
  persistence. Ledger events record memory ids, states, and hashes, not memory
  body content.
- **Scoped retrieval.** Project-scoped memories are returned only for the active
  project root token. Operator/product scopes are explicit and remain local to
  this single-operator reference.
- **Deletion model.** Founder-class delete clears title/body/tags/source content
  and leaves a `deleted-tombstone` with the prior content hash for audit.

## Memory trust hardening addendum (D34, 2026-07-07)

- **Inspectable retrieval.** Memory reads expose deterministic score reasons
  and matched fields. These are derived at read time and do not mutate memory
  records or access timestamps.
- **Stable export.** Memory export includes export version, sidecar schema
  version, project token, record counts, and deterministic ordering. Tombstones
  export audit metadata and hashes only, never deleted content.
- **Assistant context cap.** Assistant memory context is capped at 6 memories
  and 4,000 memory body characters. The response and UI show the exact memory
  context sent, memory ids used, and truncation metadata.
- **Citation and conflict warnings.** Assistant responses include read-derived
  memory citations, missing-citation warnings, and context warnings for low
  confidence, manual, stale, missing-ref, or source/ledger-sensitive memory
  use. These warnings do not arbitrate truth; source files and ledger records
  remain authoritative.

## Verification and release cockpit addendum (D35, 2026-07-07)

- **Evidence sidecar.** Verification records and release candidates persist in
  `.dreamfeed/records.json` schema v3. They are local evidence packages, never
  source truth, and every write goes through the governed lifecycle.
- **Guarded reads.** Verification/release list and export APIs are GET-only but
  action-token guarded because they disclose local project state, git metadata,
  lifecycle IDs, and release notes.
- **Ledger minimization.** Ledger events record verification/release IDs,
  states, and content hashes only. Full summaries, check details, release notes,
  and risk notes stay in the sidecar and are excluded from ledger event bodies.
- **No release automation.** D35 does not run tests, deploy, tag, push, create
  GitHub releases, or provide terminal access. Shipped marking is founder-class
  evidence, not an external release action.

## Data retention policy

Ephemeral UI state stays in memory; the Gate G/D33 control-plane sidecar
persists as described above. A process restart clears session/UI state and
assistant transcripts but keeps lifecycle records, approved memories,
verification records, release candidates, and the ledger. The future persisted
control plane must store each record with schema version, organization/
workspace/project scope, retention class, export format, deletion eligibility,
and source-authority classification. Repository sources remain in their
repository and are governed by repository retention policies.

Secrets are excluded from every export. On import, connectors re-enter pending
authorization and require fresh credential provisioning. Traces retain redacted
metadata and execution state, never credential material.

## Incident procedure

1. Halt the affected run through the policy-scoped control. Record actor,
   timestamp, reason, state, and affected project in the immutable ledger.
2. Preserve the trace, source hash, plan hash, policy version, approval, and
   result. Do not overwrite the failed evidence.
3. Assess the allowed rollback preimage. Refuse rollback if the source diverged
   after execution; reconcile manually into a new request instead.
4. Revoke the project grant or connector entitlement when scope is suspect.
5. Open a decision/ticket record with tenant/project scope. A public incident
   process requires a later security and legal approval; this reference makes no
   response-time or production-support claim.

## Production-readiness gates

Production readiness remains blocked until evidence covers tenant penetration
testing, independent security review, secret/key-management architecture,
retention/deletion controls, backup and restoration drills, incident ownership,
legal/entity approval, trademark/resemblance clearance, privacy terms,
commercial terms/pricing, support model, and three validated organizations.
Neither a passing reference suite nor a synthetic fixture run satisfies any of
these gates.
