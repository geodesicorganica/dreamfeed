# D35 - Verification And Release Cockpit

**Date:** 2026-07-07
**Status:** Resolved - implemented local evidence slice
**Owner:** Founder

## Decision

Dreamfeed adds a local verification/release cockpit layer under the existing
Gate G governed lifecycle. The layer records operator-approved verification
evidence and release candidates in the app-owned `.dreamfeed/records.json`
sidecar. These records are contextual operating evidence only: source files,
Git history, and the hash-chained ledger remain authoritative.

## Resolution

D35 implements:

- sidecar schema v3 with `verificationRecords` and `releaseCandidates`;
- policy-classed lifecycle operations for verification record creation, release
  candidate upsert, ready/abandon state changes, and founder-class shipped
  marking;
- guarded GET-only read/export APIs for verification and release evidence;
- a Release cockpit tab with readiness, provenance inspection, export, empty
  states, and lifecycle proposal actions.

D35 explicitly does not run tests from the server, deploy, tag, push, create
GitHub releases, or add terminal access. It records evidence the operator can
inspect and approve.

## Policy Classes

| Operation | Class |
|---|---|
| `verification-record-create` | `approve` |
| `release-candidate-upsert` | `approve` |
| `release-mark-ready` | `approve` |
| `release-abandon` | `approve` |
| `release-mark-shipped` | `founder` |

Project policy may deny these operations. It may not weaken shipped marking
below founder-class, and it may not weaken D35 approve-class writes to auto.

## Constraints Carried Forward

- No new mutating routes; all writes use
  intent -> plan -> approve -> execute -> ledger.
- Ledger events record record IDs, states, and hashes, never full verification
  summaries or release notes.
- Reads and exports require the active project/action token because local
  release evidence can disclose sensitive project state.
- Records are project-scoped by root token and exportable with versioned JSON.
- D35 is not external validation, SaaS readiness, deployment readiness, or
  public release capability.
