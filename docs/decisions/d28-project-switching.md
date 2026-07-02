# D28 — Multi-Project Root Selection

**Date:** 2026-06-29
**Status:** Resolved — founder-approved
**Owner:** Founder

## Decision

The Dreamfeed Command Center gained a multi-project root-selection capability:
at runtime, the read-only cockpit can be pointed at a different local project
folder. Default remains the Stakeport OS repo at `c:\Projects\stakeport_os`.

## Context

The original PS-002 Phase 1 scope treated the Dreamfeed cockpit as
single-project (Stakeport OS only). D28 extends it as an addendum: any local
folder can be selected at runtime, enabling the cockpit to serve as the
Agentic-Business OS reference surface for non-Stakeport projects.

This decision overlaps with the deferred Phase 1.3 "workspace-import" path and
is decoupled from Gate 5b (which remains separately open and unaffected).

## Constraints carried forward

- Localhost-only retained.
- GET-only retained.
- Read-only retained.
- Five approved constraint relaxations:
  1. A written `project-config.json` sidecar (gitignored) persists the selected root.
  2. A state-changing `/api/project` GET sets the active project.
  3. File-viewer containment rebased onto the user-chosen root.
  4. Persistence across server restart via the sidecar.
  5. One active project per server instance.

## Rationale trail

- Staging rationale: `.claude/plans/2026-06-26-dreamfeed-project-switching.md` (stakeport_os)
- Approval write-through audit: `.claude/plans/2026-06-29-d28-approval.md` (stakeport_os)
- CLAUDE.md note: "D28 approved 2026-06-29" in Track B build-state table, row 10.
