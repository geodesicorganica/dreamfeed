# Verification Workflow

## Before submitting for gate review

1. **Run the portable test suite.**
   ```
   npm test
   ```
   All tests must pass (one legacy skip is expected; the suite is the source of
   truth for counts). A regression here blocks submission.

2. **Run integration tests** if project-selection or state-parsing changed.
   ```
   DREAMFEED_STAKEPORT_ROOT=c:\Projects\stakeport_os npm run test:integration
   ```
   All integration tests must pass.

3. **Self-verify against the open punchlist.** Check
   `agents/developer/outputs/command-center/` in the Stakeport OS repo for the
   most recent acceptance punchlist. Confirm each item is still met in the
   current cockpit.

4. **Do not self-accept gate 5b or any founder gate.** Record findings as a
   verification document and mark it "self-verified" — the founder makes the
   final call.

## Git hygiene before commit

- Stage only files relevant to the change (no accidental `project-config.json`
  commits — it is gitignored).
- Commit `package-lock.json` alongside `package.json` changes.
- Use descriptive commit messages scoped to the change:
  `feat(topology): restore edge inventory lists below graph`
  `docs: migrate Dreamfeed standalone source docs`
  `fix(project-picker): default to stakeport_os when no config`

## Constraint checklist (Gate G, per D31)

Before any commit, confirm:

- [ ] Loopback serving: server still binds 127.0.0.1; guards on every route;
      no new outbound egress outside the assistant adapter.
- [ ] Method policy: non-GET handlers exist only on the enumerated mutating
      routes; everything else returns 405.
- [ ] Governed writes: every source-repo write goes through
      intent → plan → approval → execute → ledger; no direct write path added.
- [ ] Containment: writes are root-contained (dot-dot, realpath, `.git`/
      `node_modules` blocks) and `rootToken`-bound.
- [ ] Drift detection: approvals bind planHash; changed base hashes invalidate.
- [ ] Ledger: every lifecycle transition appends an event; chain verifies; no
      event mutation.
- [ ] Policy: new operations carry an explicit policy class; unknown → denied.
- [ ] Six-object model: Gate C semantics unchanged.
- [ ] Three-tier provenance: Canonical / Derived / Candidate labels preserved
      (native schema included).
- [ ] Self-hosted assets: no new CDN runtime dependencies; zero runtime deps.
