# Agent instructions

Read `CLAUDE.md` for project instructions and the binding runtime constraints
(localhost-only serving; the governed write envelope PS-003 / Gate G — writes
to the selected project only through the intent → plan → approval → execute →
immutable ledger lifecycle; everything else stays 405).

- Run `npm test` before committing any change to `src/` or `public/app.js`; the
  suite includes constraint regression tests (`test/constraints.test.js`).
- Enable the commit gate once per clone: `git config core.hooksPath .githooks`
- Workflows: `docs/workflows/` (development, verification, grill-me discovery).
- Do not self-accept founder gates; record self-verification only.
