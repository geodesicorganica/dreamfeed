# D33 - Governed Memory Layer

**Date:** 2026-07-07  
**Status:** Resolved - founder-requested implementation  
**Owner:** Founder / Dreamfeed

## Context

D31 added the governed write lifecycle and `.dreamfeed/` sidecar for intents,
plans, approvals, executions, and the ledger. The sidecar persisted operational
history but not agent/operator memory. Stakeport had useful cross-session memory
patterns, but its own audit found no content-specific memory steward for
approved claims, rejected language, or reusable operating learnings.

Dreamfeed needs continuity without hidden truth. Source files remain source
truth, the hash-chained ledger remains event truth, and memory is a
non-authoritative contextual aid.

## Options considered

| Option | Result |
|---|---|
| Manual notes only | Too weak for an operating cockpit; does not support assistant recall. |
| Auto-save assistant memory | Rejected; creates hidden truth and correction risk. |
| Vector memory first | Deferred; violates the zero-runtime-dependency posture unless separately approved. |
| Governed sidecar memory | Accepted; fits Gate G and keeps writes approval-gated. |

## Resolution

Add a governed memory layer in the app-owned `.dreamfeed/` sidecar:

- Sidecar schema migrates from v1 to v2 and adds `memories`.
- Memory kinds are `semantic`, `episodic`, `procedural`, and `preference`.
- Memory states are `active`, `archived`, and `deleted-tombstone`.
- Memory writes use existing lifecycle routes only:
  intent -> plan -> explicit approval -> execution -> ledger.
- Policy defaults:
  `memory-upsert` and `memory-archive` are `approve`;
  `memory-delete` is `founder`.
- Retrieval is structured + keyword in v1. Vector retrieval remains a future
  decision and must not add an unapproved dependency/provider.
- Assistant memory context is composed server-side, shown in the UI, and treated
  as non-authoritative. Source-backed docs and ledger records win on conflict.

## Constraints carried forward

- No new mutating routes.
- No memory auto-save from assistant chat.
- No secrets in memory, ledger events, logs, or exports.
- No memory record is source truth or hidden governance truth.
- Project-scoped memory must not be retrieved across project roots.
- Deleted memory clears body/title/tag content and leaves only an audit
  tombstone/hash.
