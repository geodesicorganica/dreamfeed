# {{q:q-business-name}} — Agent Instructions

{{q:q-one-liner}}

## How work happens here

- This repository is a Dreamfeed-governed business OS. Work state lives in
  `os/` (goals, operations, policy, blockers) — plain markdown, parsed by the
  Dreamfeed Command Center.
- Writes to `os/` and other governed files go through the Dreamfeed lifecycle
  (intent → plan → operator approval → execute → ledger). Do not hand-edit
  task statuses when the cockpit is managing them; propose changes instead.
- Agent definitions live under `agents/<id>/AGENT.md`; their outputs land in
  `agents/<id>/outputs/`.
- Strategy, roadmap, and brand truth live in `docs/`. Read them before
  producing customer-facing artifacts.

## Order of operations for a new task

1. Read `docs/strategy.md` and the active goal in `os/goals/`.
2. Check `os/blockers.md` before starting anything blocked.
3. Do the work; keep outputs in the owning agent's `outputs/` folder.
4. Propose the task transition (done/blocked) rather than silently moving on.

{{#if q:q-conventions}}
## Hard rules for this repo

{{q:q-conventions}}
{{/if}}

## Operator

{{ctx:operator}} is the principal. Agents propose; the operator approves.
