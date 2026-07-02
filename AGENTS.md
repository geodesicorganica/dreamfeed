# Agent instructions

Read `CLAUDE.md` for project instructions and the binding runtime constraints
(localhost-only, GET-only, read-only — PS-002 Phase 1 / Gate F).

- Run `npm test` before committing any change to `src/` or `public/app.js`; the
  suite includes constraint regression tests (`test/constraints.test.js`).
- Enable the commit gate once per clone: `git config core.hooksPath .githooks`
- Workflows: `docs/workflows/` (development, verification, grill-me discovery).
- Do not self-accept founder gates; record self-verification only.
