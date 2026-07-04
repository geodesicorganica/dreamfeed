# Dreamfeed-Native Governance Schema (v1)

Authorized by D31. This is the schema the parser supports **in addition to** the
Stakeport layout (Gate C six-object family, unchanged). A project using this
schema keeps its work structures as plain markdown under `os/` in its own repo:
git-versioned, human-editable, and written by Dreamfeed only through the
governed lifecycle. This fulfills the D30 deferral criterion.

## Layout

```
os/
  goals/<slug>.md        one file per Goal
  operations/<slug>.md   one file per Operation
  policy.md              operation → policy class table (optional)
  blockers.md            blocker table (optional)
```

## Goal file — `os/goals/<slug>.md`

```markdown
---
schema: dreamfeed/v1
type: goal
status: active            # planned | active | done | archived
owner: Founder
target_date: "2026-09-30"
sprint_week: "2026-06-29" # optional; active-sprint anchor
date_modified: "2026-07-03"
---
# Goal: <Title>

## Phase: <Phase title>

### Milestone: <Milestone title>

| ID | Task | Status | Est | Scheduled | Owner |
|---|---|---|---|---|---|
| T1 | Do the thing | planned | 2h | 2026-07-03 | Founder |
```

Hierarchy: **Goal → Phase (`## Phase:`) → Milestone (`### Milestone:`) → Task
(table row)**. Task `Status` ∈ `planned | active | done | blocked`. `Scheduled`
is an ISO date or empty. Task IDs are unique within one file; the global task
id is `<goal-slug>:<ID>`.

## Operation file — `os/operations/<slug>.md`

```markdown
---
schema: dreamfeed/v1
type: operation
status: active
owner: Founder
cadence: weekly           # informational; scheduling stays explicit per task
date_modified: "2026-07-03"
---
# Operation: <Title>

## Workflow: <Workflow title>

| ID | Task | Status | Est | Scheduled | Owner |
|---|---|---|---|---|---|
| W1 | Recurring step | planned | 1h | 2026-07-04 | Founder |
```

Hierarchy: **Operation → Workflow (`## Workflow:`) → Task (table row)**. Run
instances (materialized executions of a workflow) are control-plane records in
the app sidecar, never written into the source repo.

## Policy file — `os/policy.md` (optional)

```markdown
---
schema: dreamfeed/v1
type: policy
---
| Operation | Class |
|---|---|
| task-transition | auto |
| work-file-edit | approve |
| git-add | approve |
| git-commit | approve |
| git-branch | approve |
| git-switch | approve |
| git-push | founder |
| rollback | founder |
```

Classes: `auto` (ledgered, policy-approved), `approve` (explicit approval),
`founder` (approval + typed confirmation), `denied` (unplannable). Unknown
operations default to `denied`; a missing file yields the defaults above.

## Provenance and projection rules

- Every parsed field carries the Gate C tier model (`Canonical` for direct
  reads, `Derived` for computed values, degraded fields are `nys`).
- The **daily queue is a projection, never stored**: a queue item is
  `{task, streamType: goal|operation, chain}` where `chain` preserves the full
  parent path. Goals and Operations never flatten into each other; they meet
  only in the projection.
- Rollover: a task with `Scheduled < today` and status not `done` is
  rolled-over. Sprint membership: tasks scheduled within the sprint week
  declared by the owning file's `sprint_week` (placeholder semantics per D31 —
  confirm before extending).
- Writes to these files happen **only** via the governed lifecycle (D31), which
  rewrites the file atomically with base-hash drift detection.
