# Development Workflow

## Principles

- Plan before implementing non-trivial changes (see `grill-me-discovery.md`).
- Preserve localhost-only and read-only constraints unless a separate approved
  decision explicitly relaxes them.
- Keep runtime behavior unchanged when making documentation or harness changes.
- Commit `package-lock.json` — this is a standalone Node.js app; reproducible
  installs matter.

## Running the app

```
npm start
```

Starts the server at `http://localhost:3000`. Select a project folder via the
Project button to point the cockpit at any local repo.

Default project: `c:\Projects\stakeport_os` (or the value in
`project-config.json` if present).

## Running tests

```
npm test
```

Runs the portable test suite (50 tests, 1 skip expected). No environment
variables required.

```
DREAMFEED_STAKEPORT_ROOT=c:\Projects\stakeport_os npm run test:integration
```

Runs the integration test suite (22 tests) against a real Stakeport OS repo.

## When to run tests

- After any change to `src/` or `public/app.js`: run `npm test`.
- After any change to project-selection or state-parsing behavior: run
  integration tests.
- After documentation-only changes with no app path references: tests optional
  but recommended.

## Constraints

Never introduce the following without a separate founder-approved decision:

- Write paths to the source repository.
- Variable mutation, pause/resume, halt, or rollback execution controls.
- Persistence of server-side state beyond the current `project-config.json`
  sidecar.
- External network calls from the server.
- CDN or runtime dependencies loaded at serve-time.

These are gated by PS-002 Phase 1 and Gate F. The next execution-enabled phase
requires explicit approval.
