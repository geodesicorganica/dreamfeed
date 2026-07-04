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

No default project: the server starts with no project selected and shows the
picker. The chosen root persists in `project-config.json` (gitignored,
machine-specific).

## Running tests

```
npm test
```

Runs the portable test suite (all must pass; one legacy skip is expected — the
suite itself is the source of truth for counts). No environment variables
required.

```
DREAMFEED_STAKEPORT_ROOT=c:\Projects\stakeport_os npm run test:integration
```

Runs the integration test suite against a real Stakeport OS repo.

Full-pipeline coverage that does **not** need a Stakeport checkout runs inside
`npm test` via the checked-in fixture at `test/fixtures/generic-governance/`
(`test/fixture-governance.test.js`) — this is what CI exercises. The fixture is
also a governance-shaped demo repo the cockpit can be pointed at.

## When to run tests

- After any change to `src/` or `public/app.js`: run `npm test`.
- After any change to project-selection or state-parsing behavior: run
  integration tests.
- After documentation-only changes with no app path references: tests optional
  but recommended.

## Constraints (PS-003 / Gate G, per D31)

Permitted only within the governed envelope:

- Source-repo writes: only via the intent → plan → approval → execute → ledger
  lifecycle (root-contained, hash-revalidated, policy-classed).
- Non-GET routes: only the enumerated mutating routes; all else 405.
- Server-side persistence: only `project-config.json` and the gitignored
  `.dreamfeed/` control-plane sidecar.
- Outbound network: only the assistant adapter to user-configured model
  providers; the serving surface stays loopback-only.

Never introduce without a further founder-approved decision:

- Free-form terminal or arbitrary shell execution (commands are named and
  policy-declared only).
- Deploy triggers.
- Git force-push or history rewrites (permanently `denied` class).
- CDN or runtime dependencies loaded at serve-time; any runtime dependency.
- Cross-project writes or a second concurrent active project.

Gate C six-object parser semantics remain frozen. Founder gates are never
self-accepted.
