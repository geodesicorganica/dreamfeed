# Dreamfeed Decision Log

Decisions D28+ are Dreamfeed-scoped. Pre-D28 decisions live in the Stakeport
OS decision queue (`agents/founder/outputs/decision_queue.md` in
`c:\Projects\stakeport_os`).

## Decision Index

| ID | Decision | Date | Status | Record |
|---|---|---|---|---|
| D28 | Multi-project root selection / workspace isolation | 2026-06-29 | Resolved — accepted | [d28-project-switching.md](d28-project-switching.md) |
| D29 | Standalone extraction to `c:\Projects\dreamfeed-command-center` | 2026-07-01 | Resolved — completed | [d29-standalone-extraction.md](d29-standalone-extraction.md) |
| D30 | Work-item home: GitHub Issues now; `os/` layer deferred to parser generalization | 2026-07-02 | Resolved — founder decision | [d30-work-item-home.md](d30-work-item-home.md) |
| D31 | Write-Enabled Command Surface (PS-003 / Gate G): governed write lifecycle, native schema, assistant adapter | 2026-07-03 | Resolved — founder-approved | [d31-write-enabled-command-surface.md](d31-write-enabled-command-surface.md) |
| D32 | Human-rooted topology, discovery scanner, promotion to `os/topology.md` (adoption bridge) | 2026-07-06 | Resolved — founder-accepted | [d32-human-rooted-topology.md](d32-human-rooted-topology.md) |
| D33 | Governed Memory Layer: approved sidecar memory, structured retrieval, assistant context visibility | 2026-07-07 | Resolved — founder-requested | [d33-governed-memory-layer.md](d33-governed-memory-layer.md) |
| D34 | Memory Trust Hardening: retrieval reasons, provenance inspector, export envelope, assistant citations/warnings | 2026-07-07 | Resolved — implemented completion pass | [d34-memory-trust-hardening.md](d34-memory-trust-hardening.md) |
| D35 | Verification And Release Cockpit: local evidence records and release candidates | 2026-07-07 | Resolved — implemented local evidence slice | [d35-verification-release-cockpit.md](d35-verification-release-cockpit.md) |

## Adding new decisions

Add a row to this index and create a `dNN-short-name.md` file in this folder.
Follow the format in the existing decision files: Decision, Date, Status, Owner,
Context, Options considered, Resolution, Constraints carried forward.

Tag decisions that are pending founder review with `Status: staged` and the
date staged.
