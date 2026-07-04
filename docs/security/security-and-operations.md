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

## Data retention policy

Ephemeral UI state stays in memory; the Gate G control-plane sidecar persists
as described above. A process restart clears session/UI state but keeps
lifecycle records and the ledger. The future persisted control plane must
store each record with schema version, organization/workspace/project scope,
retention class, export format, deletion eligibility, and source-authority
classification. Repository sources remain in their repository and are governed
by repository retention policies.

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
