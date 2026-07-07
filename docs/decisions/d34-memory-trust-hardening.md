# D34 - Memory Trust Hardening

**Date:** 2026-07-07  
**Status:** Resolved - implemented completion pass  
**Owner:** Founder / Dreamfeed

## Context

D33 introduced governed sidecar memory as an approved contextual aid. The first
implementation proved the safety model: no new mutating routes, no assistant
auto-save, no secrets, scoped retrieval, export, tombstones, and visible
assistant context.

The next risk was operator trust. A memory can be safe but still hard to audit
if the cockpit does not explain why it was retrieved, which filters were active,
how much context reached the assistant, or what an export contains.

## Options considered

| Option | Result |
|---|---|
| Add embeddings/vector search | Deferred; requires a future provider/dependency decision. |
| Keep D33 as-is | Rejected; safe memory still needed better inspection and verification. |
| Harden reads, UI, exports, and assistant visibility | Accepted; strengthens trust without widening the write envelope. |

## Resolution

D34 hardens D33 memory reads and cockpit visibility:

- `GET /api/memory` remains guarded and GET-only, and now accepts additive
  filters for query, kind, state, scope, tag, limit, and retrieval reasons.
- Retrieval exposes deterministic score, matched fields, and reason strings
  derived from scope, kind, tag/title/body keyword hits, recency, source, and
  confidence.
- `GET /api/memory/export` returns a stable export envelope with export
  version, sidecar schema version, generated timestamp, project token, counts,
  and deterministic record ordering.
- Assistant memory context is capped at 6 memories and 4,000 memory body
  characters. The response includes memory ids used, the exact visible memory
  context, retrieval reasons, citations, citation-warning metadata, conflict
  warnings, and truncation metadata.
- The Memory cockpit surface shows filters, provenance, retrieval reasons,
  archive/tombstone visibility, export counts, and hard-delete approval
  messaging.
- Memory records are selectable in the shared inspector. The inspector shows
  sidecar provenance, lifecycle/ledger traces when available, retrieval
  metadata, warnings, and tombstone audit metadata.
- Export polish is read-only: deterministic JSON filename, generated timestamp,
  included record counts, and explicit language that export is evidence, not
  source truth or an import/write action.

## Constraints carried forward

- No new mutating routes.
- No schema v3 migration; D34 derives retrieval metadata at read time.
- No vector search, embeddings, new dependencies, or provider calls.
- No import writes. Any future import must create governed memory-upsert
  proposals through the existing lifecycle.
- Memory remains non-authoritative. Source files and the ledger win on
  conflict.
- Memory writes still use intent -> plan -> explicit approval -> execute ->
  ledger only.
- Deleted tombstones remain audit-only and never enter assistant context.
