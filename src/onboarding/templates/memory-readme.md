# Memory — {{q:q-business-name}}

Durable operating knowledge that outlives any single session or agent run.

## Structure

- `memory.md` — index of memory files with one-line descriptions
- `decisions.md` — dated log of operating decisions and their why
- `learnings.md` — what worked, what failed, what to never repeat

## Rules

1. One fact per entry: date, what, why.
2. Agents read this folder before starting work; write-backs are proposed to
   the operator, never silent.
3. The Dreamfeed cockpit's governed sidecar memory is separate and
   non-authoritative; this folder is the repo-versioned record.
