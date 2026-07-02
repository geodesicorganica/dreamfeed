---
brand: Dreamfeed
document: Command Center Primitives
date: 2026-06-21
status: Active companion draft
scope: Dreamfeed-only product and UX primitives
---

# Dreamfeed Command Center Primitives

Dreamfeed brand guidance must be buildable. These primitives define the
interface architecture the brand should support. They apply to Dreamfeed and
the Command Center only; they do not update the parent Stakeport brand system.

## Five Persistent Regions

Dreamfeed uses five persistent operating regions.

1. Left sidebar - navigation, work modes, pinned objects, and high-level
   operating context.
2. Top command bar - search, commands, current mode, filters, and session-level
   controls.
3. Main canvas - the active work surface: overview, graph, board, table, IDE, or
   dashboard lens.
4. Right inspector - selected-object detail, provenance, relationships, status,
   and available actions.
5. Bottom panel - logs, command output, validation results, traces, and
   execution history.

The regions may be docked, hidden, resized, or density-adjusted, but the mental
model remains stable. The user should always know where navigation, commands,
work, inspection, and logs live.

### Spatial Zoning

The main canvas is the Primary Control Zone: keep mission-critical interactive
inputs, primary editors, and diagnostic state notifications within the central
30-degree visual cone. The surrounding secondary regions form the Secondary
Monitoring Zone, positioned for horizontal glance access at 15-30 degrees from
center: use them for system health, agent queues, topology context, and
secondary detail without displacing active work.

Apply a 3:1 Luminance Balance Limit between the Primary Control Zone and any
Secondary Monitoring Zone. A persistent region may be dimmer or brighter to
show hierarchy, but no zone can force repeated pupil adaptation during normal
cross-panel scanning.

### Bottom Panel Primitive

#### MVP V1 Boundary

Dreamfeed MVP V1 is localhost-only and read-only. In V1, the bottom panel must
show source-backed, inspectable traces, variables, provenance, and ledger
history, but it must not mutate variables, source files, or process state.

#### Execution-Enabled Phase

The bottom panel becomes an interactive execution and evidence surface only in
an explicitly approved execution-enabled phase. It must never be a static-text
console: for an active execution trace, the operator must have Surgical
Overrides to pause at a trace step, inspect the current inputs and variables,
modify authorized variables, and then resume, halt, or roll back through
explicit controls.

Every override action requires an immediate Visual Ledger Confirmation in the
trace: record the action, affected step, prior and resulting values where
applicable, operator or source authority, timestamp, and resulting execution
state. Plain log text without inspectable state or override controls is not an
acceptable execution-trace implementation.

## Unified Typed Object Model

Dreamfeed should treat OS work as typed objects, not as unrelated UI cards.

Object families include:

- Strategic initiative.
- Work item.
- Approval.
- Milestone.
- Review.
- Learning signal.
- Agent.
- Skill.
- Source file.
- Output artifact.
- Decision or clarification.

One object should be stored once and rendered through multiple views. Do not
duplicate object truth to satisfy a visual layout. Views may project or filter
an object, but they must not become competing sources of truth.

Every object should expose:

- Type.
- Title.
- State.
- Owner or source authority.
- Source path or provenance.
- Last updated or last observed timestamp.
- Relationships to other objects.
- Available next action, if any.

## View Registry

Dreamfeed should support multiple lenses over the same object model.

Required lenses:

- IDE lens - source files, folders, diffs, command output, and traces.
- Notion-style document lens - narrative notes, specs, and linked records.
- Board lens - work items grouped by state, dependency, or priority.
- Dashboard lens - operating cockpit, health, blockers, and top-level signals.
- Table lens - dense comparison, audit, and sorting workflows.
- Topology / Graph lens - an actual node-and-edge representation of the agentic
  organizational chart, object relationships, and visual data wiring. It must
  support selection, inspection, and provenance without creating a separate
  object truth from the other lenses.

The view registry should make the lens explicit. The same object can appear in
several lenses, but its identity, state, and provenance must remain consistent.

## State Model

Dreamfeed state is split into three layers.

### Server State

Server state is source-backed or computed from source-backed files. It includes
parsed governance objects, topology edges, audit status, repo health, and
current file-derived object state.

Rules:

- Treat markdown/governance/source files as canonical unless a later approved
  architecture changes that.
- Label cached or manually observed state.
- Show last parsed, last audited, or last observed timestamps.

### UI State

UI state belongs to the shell and current interaction. It includes selected tab,
open drawers, expanded rows, active filters, density, panel visibility, and
sort order.

Rules:

- UI state should improve continuity without pretending to be source truth.
- Missing UI state should fall back to a stable default, not a blank screen.
- UI state must not alter source-backed object state.

### Editor/View State

Editor/view state belongs to a specific lens or editor model. It includes cursor
position, scroll offset, open files, split panes, graph viewport, selected nodes,
and per-view layout state.

Use Monaco-style persistence as the mental model: preserve editor/view state
independently of the shell where practical, so changing views does not destroy
the user's working context.

## Deterministic Layout Stability

Dynamic layout shifts during content loading are prohibited. Persistent regions,
code blocks, trace rows, tables, and diagnostic areas must reserve stable
dimensions before asynchronous content resolves. Loading, empty, stale, and
error states occupy the same allocated space as their resolved state so the
operator's visual field, pointer target, and scan path do not move unexpectedly.

## Review Standard

A Dreamfeed design or brand artifact is acceptable only if it supports these
primitives directly. A polished visual identity that cannot explain regions,
objects, views, and state ownership is not buildable enough for the Command
Center.
