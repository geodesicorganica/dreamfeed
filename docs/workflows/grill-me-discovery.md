# Grill-Me Discovery Workflow

Major Dreamfeed changes — harness architecture, product direction, brand
decisions, or design-system evolution — should start with a one-question-at-a-
time discovery pass before implementation begins.

## When to use

Use this workflow before:

- Changing the server API, parser, or six-object model.
- Adding a new lens, region, or object type to the cockpit.
- Making product or brand decisions that affect multiple files.
- Running a migration, refactor, or structural reorganization.
- Any change that would be hard to reverse once committed.

Skip it for routine bug fixes, token value corrections, or small isolated
changes where the scope is already clearly bounded.

## How it works

1. **Inventory first.** Read the relevant source files, current state, and any
   prior decisions before forming questions. Do not ask questions that the code
   or docs can answer.

2. **One question at a time.** Pose exactly one question per exchange. Include
   your recommended answer and the reasoning behind it. Wait for an explicit
   response before proceeding.

3. **Document the outcome.** Record the final decision in `docs/decisions/` if
   it is Dreamfeed-scoped and durable. Update relevant docs if the decision
   changes current guidance.

4. **Hold until approval.** Do not edit files during discovery. Wait for an
   explicit "go" or approval before executing.

## Example question format

> **Question:** Should the topology graph deduplicate edges with the same source
> and target, or show all edges including duplicates (offset visually)?
>
> **Recommendation:** Show all 86 edges including duplicates, offset visually —
> this matches the Gate C source semantics where each relationship is a separate
> provenance record. Silent deduplication hides information.

## Why

The grill-me pattern surfaces constraints and prior decisions before
implementation, preventing reverts and approval-gate failures. It is especially
important in Dreamfeed because the six-object model, provenance semantics, and
Gate C constraints are subtle and easy to violate accidentally in a refactor.
