# Dreamfeed Command Center — Project Instructions

## Repo identity

Dreamfeed Command Center is a standalone Git repository.
- **GitHub:** https://github.com/geodesicorganica/dreamfeed
- **Local:** `C:\Projects\dreamfeed-command-center`
- Stakeport OS is a **separate** repo at `C:\Projects\stakeport_os` and is selected
  at runtime via the Project picker — it is not embedded here.

## Runtime constraints (do not relax without a founder-approved decision)

- Localhost-only. No external network calls from the server.
- GET-only. No write paths to source repositories.
- Read-only. No variable mutation, pause/resume, halt, or rollback controls.
- In-memory UI state. Non-persistent V1 boundary.
- Project switching must preserve workspace isolation: one active project per
  server, containment enforced against the user-chosen root, no cross-project
  state leakage.

These constraints are binding under PS-002 Phase 1 and Gate F. The next
execution-enabled phase requires explicit founder approval.

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
