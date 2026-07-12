# Dreamfeed Command Center

Localhost-only governance cockpit and **write-enabled command surface** for
agentic-business OS operators (PS-003 / Gate G, D31). Parses markdown tracking
files — the Stakeport governance layout and the Dreamfeed-native `os/`
Goals/Operations schema — and surfaces live strategic state, a daily execution
queue, sprint metrics, topology, and repo health. Writes to the selected
project and approved memory writes happen **only** through a governed lifecycle:
intent → plan → explicit approval → execution → immutable hash-chained ledger.

**GitHub:** https://github.com/geodesicorganica/dreamfeed
**Local path:** `C:\Projects\dreamfeed-command-center`

## Quick start

```
npm install
npm start
```

One-time setup per clone — enable the commit gate (runs `npm test`, including
the PS-002/Gate F constraint tests, before every commit):

```
git config core.hooksPath .githooks
```

Opens at `http://localhost:3000`. Use the **Project** button to select a local
project folder. Stakeport OS (`C:\Projects\stakeport_os`) is not embedded — select
it through the picker after startup.

## Commands

| Command | What it does |
|---|---|
| `npm start` | Start the server at localhost:3000 |
| `npm test` | Run portable test suite (all tests must pass; one legacy skip is expected) |
| `npm run test:integration` | Run integration tests against a real repo (requires `DREAMFEED_STAKEPORT_ROOT`) |

## Integration test

```powershell
$env:DREAMFEED_STAKEPORT_ROOT = "C:\Projects\stakeport_os"
npm run test:integration
```

## Constraints (PS-003 / Gate G, per D31)

- Loopback-only serving — binds 127.0.0.1; host/origin/token guards everywhere.
- Governed writes only — every source-repo mutation passes
  intent → plan → approval → execute → ledger, root-contained and
  drift-detected. Non-GET methods exist only on the lifecycle routes.
- Policy classes — `auto` (task transitions) / `approve` (work edits, git
  add/commit/branch/switch, memory upsert/archive) / `founder` (push,
  rollback, memory delete — typed confirmation) / `denied` (force-push,
  out-of-root, `.git/`). Project override:
  `os/policy.md`.
- Governed memory — `.dreamfeed/` schema v2 stores approved contextual aids;
  memory is inspectable/exportable, never source truth, and never auto-saved
  from assistant chat.
- Workspace isolation — one active project per server; no cross-project writes.
- Zero runtime dependencies; free-form terminal and deploy triggers stay gated.

## Project onboarding (D36)

"Set up this project…" (Daily Queue / Overview when a project has no
governance layer) or "＋ New project here" (Project dialog) opens the guided
onboarding wizard: discovery findings → a deterministic interview → per-family
review with per-file diffs and answer provenance → one approval per artifact
family (os/ layout, agents, harness, docs, memory), each file hash-bound and
ledgered. Brownfield repos get their existing initiative tables proposed as
Goal drafts (governed import — nothing renders as truth until approved).
Existing files are merged or skipped, never overwritten.

## Assistant (optional)

The right-region Assistant dock (Chief of Staff / Translator / Chat) is set up
from the app: the **⚙ Connect** button probes for installed assistant CLIs
(one-click connect reuses your existing login — no key typed) or takes a
provider preset + API key, and writes the local, gitignored
`assistant-config.json` for you (D37). Hand-authoring the file still works.
Two provider shapes (the adapter is the only module with outbound egress; keys
never enter the repo, ledger, or logs):

```json
{ "provider": "cli", "cli": { "command": "claude", "args": ["-p"] } }
```

The prompt is delivered to the CLI on **stdin** (so it works cross-platform,
including Windows `.cmd` shims, and avoids arg-length limits). The configured
command must read its prompt from stdin.

```json
{ "provider": "http", "http": { "url": "http://localhost:11434/api/chat", "model": "llama3.1" } }
```

For cloud providers, point `http.url` at the endpoint and put the key in
`http.headers` (e.g. `{ "Authorization": "Bearer …" }` or `{ "x-api-key": "…" }`).

See `docs/` for brand, product, design-system, and decision documentation —
`docs/decisions/d31-write-enabled-command-surface.md` defines the write
envelope, `docs/decisions/d33-governed-memory-layer.md` defines memory, and
`docs/product/native-schema.md` the Goals/Operations file format.
