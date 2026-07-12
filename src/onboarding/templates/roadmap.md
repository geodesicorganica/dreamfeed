---
generated_by: dreamfeed-onboarding/v1
date_modified: "{{ctx:date}}"
---
# {{q:q-business-name}} — Roadmap

The roadmap is intentionally thin at onboarding: phases become real as goals
are created under `os/goals/`. The cockpit's Roadmap lens reads the Phase
structure of those goal files — this document narrates intent.

## Phase sequencing

- **Phase 1 — Prove: {{q:q-goal-milestone}}** — deliver the first goal
  ({{q:q-goal-title}}){{#if q:q-goal-target-date}} by {{q:q-goal-target-date}}{{/if}}.
- **Phase 2 — Operate: recurring cadence** — the operations tracked in
  `os/operations/` run without heroics{{#if q:q-cadences}} ({{q:q-cadences}}){{/if}}.
- **Phase 3 — Grow: toward the 12-month definition** — {{q:q-success-12mo}}

## How phases advance

A phase advances when its goal files are done in `os/goals/` — status changes
flow through the governed lifecycle, so the roadmap never drifts silently from
the work.
