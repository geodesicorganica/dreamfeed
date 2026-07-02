# Security, retention, incident, and readiness runbook

## Data retention policy

The reference keeps control-plane state in memory only. A process restart
clears session state, indexes, plans, approvals, runs, traces, and secrets. The
future persisted control plane must store each record with schema version,
organization/workspace/project scope, retention class, export format, deletion
eligibility, and source-authority classification. Repository sources remain in
their repository and are governed by repository retention policies.

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
