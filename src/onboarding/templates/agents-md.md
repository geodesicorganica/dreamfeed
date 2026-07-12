# AGENTS.md — {{q:q-business-name}}

Instructions for coding/execution agents working in this repository.
{{#if ctx:coding-agent-line}}
{{ctx:coding-agent-line}}
{{/if}}

## Repository shape

- `os/` — governed work state (goals, operations, policy, blockers, topology).
  Managed by the Dreamfeed Command Center; changes ride an approval lifecycle.
- `agents/` — agent definitions (`AGENT.md`) and their `outputs/`.
- `docs/` — strategy, roadmap, brand brief. Source of truth for intent.
- `memory/` — durable operating knowledge; read before repeating past work.

## Rules

- Never rewrite `os/` task tables wholesale; change one row per proposal.
- Keep the six-column task table shape: ID | Task | Status | Est | Scheduled | Owner.
- Status values are exactly: planned, active, done, blocked.
- New goals/operations follow `docs/product/native-schema.md` of the Dreamfeed
  product (frontmatter `schema: dreamfeed/v1`).
{{#if q:q-conventions}}- {{q:q-conventions}}{{/if}}

## Escalation

Anything irreversible (deletes, publishes, payments, deploys) goes to the
operator ({{ctx:operator}}) — agents propose and wait.
