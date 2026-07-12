# D37 — Assistant Connect: First-Run Setup, CLI Detection, Managed Config

**Date:** 2026-07-07
**Status:** Resolved — founder-accepted 2026-07-07 (grill-me discovery fork 4)
**Owner:** Founder
**Implements:** removes the hand-authored `assistant-config.json` friction from
onboarding. The D31 config file and adapter stay; the app now writes the file
itself through a guarded settings surface.
**Relation to D31:** the adapter remains the only egress module and the only
reader of the config; provider endpoints still never appear as source
literals — they move into an enumerated, constraint-tested preset data file.

## Decision

A first-run **"Connect your assistant"** screen (and a Settings dialog
afterward) replaces hand-editing `assistant-config.json`. Two tiers:

- **Tier 1 — CLI auto-detect.** The server probes for locally installed
  agent CLIs (`claude`, `codex`, `gemini`) and a running Ollama, and offers
  one-click connect as a `cli`/`http` provider. If the operator is already
  logged into Claude Code on this machine, zero keys are ever typed or
  stored — the existing CLI login is reused.
- **Tier 2 — provider preset + API key.** Preset picker
  (Anthropic / OpenAI / OpenAI-compatible / Ollama) with the endpoint
  prefilled from the preset table; the pasted key is stored only in the
  gitignored config, exactly as under D31.

OAuth device-flow is **deferred** to a future decision (no provider offers it
for raw API use today; it would also need a callback surface).

Setup is skippable: the cockpit and the D36 deterministic wizard fully work
with no assistant configured.

## Constraint-envelope impact (Gate G, scoped)

- **One new mutating route:** `/api/assistant/config` `['POST']` — create,
  update, or clear the config. With D36's route the exact mutating set becomes
  **nine** (single amendment of `test/constraints.test.js`, citing D36+D37).
- **Two new token-guarded GETs:** `/api/assistant/config` (redacted
  descriptor + preset list; the key is structurally absent from the response
  shape) and `/api/assistant/probe` (CLI detection; spawns processes, so it is
  guarded like `/api/dirs`). Both GET-only, constraint-tested.
- **fs-write allowlist:** line-scoped exemption in `src/assistant/adapter.js`
  for lines containing `CONFIG_FILE` — the exact mirror of the
  `PROJECT_CONFIG_FILE` exemption in `server.js`.
- **Conscious preset exemption:** provider endpoints live in
  `src/assistant/presets.json` (data, not source literals). The constraints
  origin test is **extended** to parse `presets.json` and assert its hosts are
  a subset of `{api.anthropic.com, api.openai.com, localhost, 127.0.0.1}` —
  the exemption is enumerated, never a scan gap.
- **Secrets:** the key is accepted only in the POST body; it never rides the
  intent→plan lifecycle (plans/approvals persist in the sidecar), never
  appears in any GET response, ledger event, or error string. The ledger event
  `assistant-config-updated` carries `{provider, preset}` only. Plaintext
  storage in the gitignored config remains the accepted D31 limitation;
  AES-256-GCM key management remains a Phase 2 gate.
- **New assistant mode `onboarding`** in the adapter's mode table (`:mode` is
  a route param — zero new routes) for D36 interview enrichment.
- Unchanged: zero runtime dependencies; localhost-only serving; adapter is the
  only egress module; founder gates never self-accepted.

## Probe design (deterministic, safe)

- Fixed probe table — never client-supplied names:
  `claude --version`, `codex --version`, `gemini --version`.
- Resolution via `where` (win32) / `which`; version check via `execFile` with
  a 3s timeout; `shell: true` on win32 only (`.cmd` shim lesson from the D31
  adapter); output caps; errors expose codes, never messages.
- Ollama detected by `fetch('http://localhost:11434/api/tags')` with a 1s
  abort (loopback — inside the origin allowlist).
- `DREAMFEED_NO_PROBE=1` disables probing entirely (deterministic tests/CI),
  mirroring `DREAMFEED_NO_NATIVE`.
- A CLI that is installed but unauthenticated probes as "found"; the first
  real call surfaces the auth failure honestly. The connect screen states
  this.

## Options considered

| Option | Result |
|---|---|
| Keep hand-authored config | Rejected — the friction this record removes; not a non-technical-founder surface |
| Key-paste settings UI only | Rejected as sole path — misses the zero-secret path for operators already running agent CLIs |
| OAuth device flow now | Deferred — no provider support for raw API use; largest envelope change; revisit when a provider ships it |
| CLI auto-detect + key paste (accepted) | Tier 1 reuses existing machine logins; Tier 2 covers everyone else; app writes the config |
