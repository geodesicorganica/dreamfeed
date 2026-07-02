# Dreamfeed Command Center

Read-only, localhost-only governance cockpit for agentic-business OS operators.
Parses markdown tracking files and surfaces live strategic state: initiative status,
weekly priorities, decisions queue, blocked items, dispatch queue, topology, and
repo health.

**GitHub:** https://github.com/geodesicorganica/dreamfeed
**Local path:** `C:\Projects\dreamfeed-command-center`

## Quick start

```
npm install
npm start
```

Opens at `http://localhost:3000`. Use the **Project** button to select a local
project folder. Stakeport OS (`C:\Projects\stakeport_os`) is not embedded — select
it through the picker after startup.

## Commands

| Command | What it does |
|---|---|
| `npm start` | Start the server at localhost:3000 |
| `npm test` | Run portable test suite (50 pass, 1 skip expected) |
| `npm run test:integration` | Run integration tests against a real repo (requires `DREAMFEED_STAKEPORT_ROOT`) |

## Integration test

```powershell
$env:DREAMFEED_STAKEPORT_ROOT = "C:\Projects\stakeport_os"
npm run test:integration
```

## Constraints (PS-002 Phase 1 / Gate F)

- Localhost-only — no external network calls from the server.
- GET-only — no write paths to source repositories.
- Read-only — no variable mutation, pause/resume, halt, or rollback controls.
- In-memory UI state — non-persistent V1 boundary.

See `docs/` for brand, product, design-system, and decision documentation.
