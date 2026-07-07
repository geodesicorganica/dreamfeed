# Dreamfeed Command Center — Project Instructions

## Repo identity

Dreamfeed Command Center is a standalone Git repository.
- **GitHub:** https://github.com/geodesicorganica/dreamfeed
- **Local:** `C:\Projects\dreamfeed-command-center`
- Stakeport OS is a **separate** repo at `C:\Projects\stakeport_os` and is selected
  at runtime via the Project picker — it is not embedded here.

## Runtime constraints (PS-003 / Gate G — do not relax without a founder-approved decision)

Hard constraints (unchanged from Gate F):
- Localhost-only **serving**: bind 127.0.0.1; host/origin/token guards on every
  route. Outbound egress is allowed only from the assistant adapter to
  user-configured model-provider endpoints (D31).
- Workspace isolation: one active project per server, realpath containment
  against the user-chosen root, `rootToken` binding on every mutation, no
  cross-project writes, no parent scanning or fallback roots.
- Zero runtime dependencies.
- Gate C parser semantics for the six Stakeport object families unchanged.
- Secrets never in project repos, memory, ledger, traces, or logs.

Write mode (relaxed by D31, scoped):
- Non-GET methods exist **only** on the enumerated mutating routes; everything
  else stays 405.
- Source-repo writes and approved memory writes happen **only** through the governed lifecycle
  (intent → plan → explicit approval → execute → immutable ledger) with
  base-hash drift detection and policy classes (`auto`/`approve`/`founder`/
  `denied` per `os/policy.md`).
- Control-plane records, including approved governed memories, live in the
  gitignored `.dreamfeed/` sidecar, never as hidden truth in source repos.
- Governed memory (D33) is non-authoritative, project-scoped by default,
  inspectable/exportable, approval-gated, and never auto-saved from assistant
  chat; `memory-delete` is `founder`-class.
- Free-form terminal and deploy triggers are **not** in scope (future candidates);
  git write actions are limited to the safe named allowlist
  (add/commit/branch/switch `approve`-class; push `founder`-class).

Any further relaxation requires a `docs/decisions/dNN` record **before**
implementation. `test/constraints.test.js` enforces this envelope mechanically.

## Before major changes

- **Plan first.** For harness architecture, product direction, or design-system
  changes, run a grill-me discovery pass (one question at a time, recommended
  answer included) before editing files. See `docs/workflows/grill-me-discovery.md`.
- **Run tests before committing** any change to `src/` or `public/app.js`:
  `npm test` must pass (the suite is the source of truth for test counts).
- **Do not self-accept gate 5b** or any founder gate. Record self-verification
  and let the founder make the final call.

## Docs

- `docs/README.md` — authority order for the docs tree
- `docs/product/` — strategy, roadmap, architecture, UX primitives
- `docs/brand/` — brand guidelines, logo spec, research
- `docs/design-system/` — tokens, components, assets, UI kits
- `docs/decisions/` — D28+ decision records
- `docs/workflows/` — development, verification, grill-me workflows
