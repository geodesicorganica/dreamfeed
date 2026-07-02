# D30 — Work-Item Home

**Date:** 2026-07-02
**Status:** Resolved — founder decision during harness planning
**Owner:** Founder
**GitHub:** https://github.com/geodesicorganica/dreamfeed

## Decision

Dreamfeed-scoped work items live in **GitHub Issues** on
`geodesicorganica/dreamfeed`; decisions continue to live in `docs/decisions/`.

A root `os/` operating layer (work-items, gates, registers, schemas) is
**deferred with an explicit criterion**: it gets built when the parser supports
a Dreamfeed-native governance schema (Phase 1.4-era product work), at which
point this repo becomes the first real consumer of the product's own
generalization.

## Context

After D29, Dreamfeed-scoped backlog had no native home: gate-5b acceptance
artifacts live in stakeport_os (`agents/developer/outputs/command-center/`),
and forward-looking items (parser generalization, validation kit, post-5b
features) had nowhere to accumulate.

Two candidate homes were evaluated:

1. **GitHub Issues + `docs/decisions/`** — zero maintenance, native to the
   published repo, agent-readable/writable via `gh`.
2. **Root `os/` layer** (current-state, work-items, gates, risk/release
   registers, schemas) — self-governance in-repo, potentially dogfoodable.

## Rationale

The `os/` option contains a hidden contradiction: the cockpit today parses
**Stakeport's** schema, so an `os/` layer is only dogfoodable if it clones
Stakeport's structure and vocabulary — exactly the "port the governance
machinery" failure mode this repo's harness planning ruled out. A
Dreamfeed-native `os/` is not parseable by the current product, making it pure
maintenance until the parser generalizes; this repo's own traceability matrix
demonstrated how unread registers go stale and mislead agents.

The demo/test value `os/` promised is delivered instead by the checked-in
generic governance fixture (`test/fixtures/generic-governance/`).

"Dreamfeed can govern its own work" becomes real the day the parser supports a
second, Dreamfeed-native schema — work that design partners will force in
Phase 1.4 regardless. Deferring `os/` to that milestone gives up nothing except
premature structure.

## Seed backlog (created 2026-07-02)

1. [#1](https://github.com/geodesicorganica/dreamfeed/issues/1) **Parser
   generalization: Dreamfeed-native governance schema** — supports a second
   schema beyond Stakeport's; unlocks the deferred `os/` layer and
   design-partner onboarding. (D30 criterion.)
2. [#2](https://github.com/geodesicorganica/dreamfeed/issues/2) **Phase 1.4
   validation kit** — grow `test/fixtures/generic-governance/` into the
   onboarding/acceptance fixture; add onboarding script, acceptance protocol,
   feedback capture.
3. [#3](https://github.com/geodesicorganica/dreamfeed/issues/3) **T29 latency
   benchmark** — the sub-100ms interaction target in the traceability matrix
   requires a measured benchmark; none exists yet.
4. [#4](https://github.com/geodesicorganica/dreamfeed/issues/4) **Gate 5b
   punchlist migration** — when gate 5b closes in stakeport_os, migrate any
   surviving items here and retire the cross-repo pointer in
   `docs/workflows/verification-workflow.md`.

## Bounded exception

Until gate 5b closes, its acceptance artifacts remain in stakeport_os and
`docs/workflows/verification-workflow.md` may point there. The exception
dissolves when 5b closes (see seed item 4).
