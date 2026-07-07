---
name: idea-capture
description: Captures passing ideas into the Stakeport OS idea backlog for later reconciliation. Use when the user says capture idea, add this idea, backlog this, idea:, feature idea, agent idea, workflow idea, or asks to review the idea backlog.
---

# Idea Capture

## Quick Start

For a quick capture, classify the idea and run:

```powershell
node .agents/skills/idea-capture/scripts/capture-idea.js --type feature --idea "Raw idea text here"
```

The script appends to `agents/founder/outputs/idea_backlog.md`, assigns the next `I-0000` ID, and updates `date_modified`.

## Capture Workflow

1. Preserve the user's raw idea. Fix obvious typos only when meaning is unambiguous.
2. Classify into one type: `feature`, `agent`, `workflow`, `research`, `go-to-market`, `compliance`, `content`, `product`, `ops`, or `other`.
3. Add the idea to `agents/founder/outputs/idea_backlog.md` with status `inbox`.
4. Acknowledge with the idea ID, type, and one concise note. Do not interrogate unless the idea is impossible to understand.

Use `--notes` for useful context, but keep capture lightweight. The point is not to spec the idea; it is to avoid losing it.

## Boundary Rules

- If the item is an explicit action for the current week, also follow `CLAUDE.md` mid-session capture and add it to `weekly_priorities.md`.
- If it is a decision, blocker, or strategic initiative, update the relevant OS tracking file first, then optionally capture the raw idea for later context.
- Do not promote ideas from the backlog into planning files without founder confirmation.
- Do not create customer-facing claims from backlog ideas.

## Review Workflow

When asked to review the backlog:

1. Read `agents/founder/outputs/idea_backlog.md`, `weekly_priorities.md`, `decision_queue.md`, `blocked_items.md`, and `strategic_initiatives.md`.
2. Group `inbox` and `parked` ideas by type.
3. Identify duplicates and existing linked initiatives.
4. Recommend one outcome per idea: `promoted`, `merged`, `parked`, or `rejected`.
5. Wait for founder confirmation before editing governance files.

After confirmation, update each backlog row's `Status`, `Triage notes`, and `Linked objects`.
