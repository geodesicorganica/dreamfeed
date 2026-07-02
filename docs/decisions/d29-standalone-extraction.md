# D29 — Standalone Extraction

**Date:** 2026-07-01
**Status:** Resolved — completed
**Owner:** Founder

## Decision

Dreamfeed Command Center extracted from `c:\Projects\stakeport_os` to a
standalone Git repository at `c:\Projects\dreamfeed-command-center`.

## Context

Through D28, the cockpit had already become a multi-project tool. Keeping it
inside the Stakeport OS repo created friction: every Dreamfeed commit mixed with
Stakeport governance commits, and the repo was the wrong unit of deployment for
a product that would eventually serve non-Stakeport users.

D29 performs a clean git subtree split so history is preserved and Dreamfeed has
its own release cadence, dependency graph, and documentation brain.

## Method

```
git subtree split --prefix=tools/command-center
```

58 files extracted; `tools/command-center/` replaced with a redirect stub
README in stakeport_os (commit `5ea63e5`).

## Post-extraction state

- **Portable tests:** `npm test` — 50 pass, 1 skip.
- **Integration tests:** `DREAMFEED_STAKEPORT_ROOT=c:\Projects\stakeport_os npm run test:integration` — 22 pass.
- **Default project:** Stakeport OS at `c:\Projects\stakeport_os` (unchanged).

## Constraints carried forward

All PS-002 Phase 1 and Gate F constraints remain binding:
- Localhost-only.
- GET-only.
- Read-only.
- In-memory UI state (non-persistent V1 boundary).
- Gate C six-object model and three-tier provenance semantics unchanged.

## Rationale trail

- Gate Transition Consistency Audit: `.claude/plans/2026-07-01-d29-audit.md` (stakeport_os)
- Re-verification record: `agents/developer/outputs/command-center/brief-b-gate5b-reverification-2026-07-01.md` (stakeport_os)
