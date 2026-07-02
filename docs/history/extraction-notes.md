# D29 Extraction Notes

_Retained as historical context. Not current authority — see `docs/decisions/d29-standalone-extraction.md` for the decision record._

## What happened

On 2026-07-01, the Dreamfeed Command Center was extracted from
`c:\Projects\stakeport_os\tools\command-center\` to this standalone repository
at `c:\Projects\dreamfeed-command-center` via:

```
git subtree split --prefix=tools/command-center
```

The extraction preserved Git history for the 58 files that were under
`tools/command-center/` at the time of the split. The resulting commit was
`5ea63e5` in the stakeport_os repo.

## What stayed in stakeport_os

- All Stakeport governance files (agents/, shared/, docs/stakeport-*).
- Dreamfeed brand and product docs under `docs/dreamfeed/` (migrated into
  this repo's `docs/` folder on 2026-07-01 as part of the docs brain migration).
- The Phase 1.3/2 reference implementation at
  `parallel-products/agentic-business-os/` (runtime code only; strategy/
  roadmap/architecture docs migrated here).
- A redirect stub README at `tools/command-center/` pointing here.

## Post-extraction test baseline

| Suite | Count | Notes |
|---|---|---|
| Portable (`npm test`) | 50 pass, 1 skip | No env vars required |
| Integration (`npm run test:integration`) | 22 pass | Requires `DREAMFEED_STAKEPORT_ROOT` |

## Docs brain migration

On 2026-07-01, Dreamfeed brand, product, design-system, and history docs were
migrated from stakeport_os into `docs/` here, giving this repo a standalone
documentation brain. Runtime behavior was not changed.

Source locations (stakeport_os):
- `docs/dreamfeed/` → `docs/brand/`, `docs/design-system/`, `docs/product/command-center-primitives.md`
- `parallel-products/agentic-business-os/STRATEGY.md, ROADMAP.md, docs/` → `docs/product/`, `docs/security/`
