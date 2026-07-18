# Dreamfeed traceability matrix

> **Re-baselined 2026-07-02 (post-D29 extraction).** This matrix was originally
> written against the Phase 1.3/2 *reference build* that lives in the
> Stakeport OS repo (`c:\Projects\stakeport_os`). Rows describing capabilities
> that are **not present in this standalone package** are now labeled
> `reference build` — they must not be read as implemented here.

Status labels are deliberately narrow:

- `implemented` — covered by code and verification **in this package**.
- `reference build` — implemented only in the stakeport_os Phase 1.3/2
  reference build; not present in this package. A founder-approved execution
  phase now exists — **D31 (PS-003 / Gate G)** authorized the governed write
  lifecycle — so the earlier Gate F prohibition on execution controls no longer
  holds; capabilities still absent here are reference-build scope, not
  Gate-F-prohibited.
- `deferred with explicit gate` — blocked by named external evidence.
- `not applicable` — prohibited for this reference.

The matrix is updated with each vertical slice.

| ID | Requirement | Status | Source | Verification evidence |
|---|---|---|---|---|
| T01 | One Dreamfeed brand from internal cockpit through spin-out | implemented | D23, `docs/brand/brand-guidelines.md` | Governance reconciliation references |
| T02 | Preserve Stakeport public brand separation | implemented | D23, Dreamfeed README | No parent-brand mutation; scope docs |
| T03 | Preserve V1 six objects, IDs, provenance, freshness, topology, viewer protections; transport/memory envelope per the active gate | implemented | PS-002 → **PS-003/Gate G (D31)** | Portable test suite (`npm test`); envelope enforced by `test/constraints.test.js` (method-policy matrix, write allowlist, egress scan) |
| T04 | Five regions, shared object identity, lens registry, Inspector, trace panel, local assets/fonts | implemented | Dreamfeed primitives | `test/ui-contract.test.js` |
| T05 | Local project selection with canonical paths and trusted grant scope | implemented | D28 | `test/project.test.js` (canonical-identity, containment, action-guard tests) |
| T06 | Git metadata/signals; non-Git inspect-only state | implemented | D28 | `test/project.test.js` (audit-root, degraded-repo tests); `src/repohealth.js` |
| T07 | No parent scanning, fallback, or unapproved execution | implemented | Architecture §Project selection | `test/project.test.js` (validateRoot denial, realpath-escape tests) |
| T08 | Explicit remote connector authorization with no repository credentials | reference build | Phase 1.3 scope | stakeport_os reference build; no connector routes exist in this package |
| T09 | Project-scoped indexes, UI state, policies, traces, artifacts, credentials | reference build | Data ownership model | Active-project isolation only is implemented here (`test/project.test.js`); policies/traces/artifacts/credentials are reference-build scope |
| T10 | Source browsing, proposed editing, diff/branch/test/deploy visibility, controlled direct instruction | implemented (first slice, D31) | Phase 1.3 scope | Source browsing (`/api/file`), governed task/work writes with diff preview (`test/write-guards.test.js`), branch/switch/commit/push named actions (`test/readiness.test.js`). **Excluded, still gated:** free-form file editing, deploy triggers, terminal |
| T11 | Portable Agent/Skill/Policy/Plan/Approval/Run/Trace/Artifact/Environment/Connector concepts | reference build | Phase 1.3 scope | stakeport_os reference build |
| T12 | Request → plan → review → approval → execution → immutable trace | implemented (D31) | Phase 1.3 scope | `src/commands/*` lifecycle; planHash-bound approvals invalidated by source drift; append-only hash-chained ledger. `test/write-guards.test.js`, `test/ledger.test.js` |
| T13 | Least privilege, confirmation, pause/resume/halt/rollback, visual ledger | partially implemented (D31) | Architecture §Lifecycle | Implemented: policy classes (auto/approve/founder/denied, unknown→denied), founder typed confirmation, divergence-refusing rollback with preimages, Visual Ledger UI (`test/write-guards.test.js`, `test/ledger.test.js`). **Deferred:** mid-flight pause/resume/halt — the synchronous single-op executor cannot service them; they require an async multi-op executor (D33+ candidate — D32 landed as the topology/discovery/promotion adoption bridge instead). Execution controls authorized by D31 (previously prohibited under Gate F) |
| T14 | Fixture workspace, onboarding, acceptance script, feedback capture, non-VS-Code protocol | reference build | Phase 1.3 scope | stakeport_os reference build; no `validation-kit/` in this package |
| T15 | Do not claim external partner validation | deferred with explicit gate | Roadmap Phase 1.3 | Two real partner evidence records |
| T16 | Self-contained relocation-ready Phase 2 product package | reference build | Phase 2 scope | stakeport_os reference build |
| T17 | Organization/workspace/project/repository and all governance/execution/entitlement objects | reference build | Phase 2 scope | stakeport_os reference build |
| T18 | Source vs control-plane ownership and Stakeport standard import | reference build | Architecture §Data ownership/migration | stakeport_os reference build |
| T19 | Membership, roles, provisioning, tenant isolation, connector least privilege, encrypted secrets, audit, observability, retention | reference build | Phase 2 scope | stakeport_os reference build |
| T20 | Plan-agnostic billing/entitlement; no payments or invented pricing | reference build | Phase 2 scope | stakeport_os reference build |
| T21 | Threat model, retention, incident/rollback, production-readiness runbooks | reference build | Phase 2 scope | stakeport_os reference build; see `docs/security/security-and-operations.md` for what applies here |
| T22 | No deployment, cloud, external accounts, or SaaS readiness claim | not applicable | Scope prohibition | No provider SDK/config in this package |
| T23 | Executive profiles, model selection, budgets, decision/ticket, release/sprint, onboarding/review | reference build | Track 3 scope | stakeport_os reference build |
| T24 | Opt-in, isolated, moderated, auditable Guild prototype | reference build | Track 3 scope | stakeport_os reference build |
| T25 | No default cross-tenant code, prompts, traces, artifacts, metadata, credentials, or business-data sharing | reference build | Track 3 scope | stakeport_os reference build |
| T26 | Gate advanced execution and Guild features | reference build | Track 3 scope | stakeport_os reference build |
| T27 | Safe asset routes, MIME checks, no CDN/runtime traversal/static docs exposure | implemented | Cross-cutting requirements | `test/ui-contract.test.js` (local-only asset routes); `src/server.js` static allowlist |
| T28 | Visibly distinct source, derived, candidate, cache, live, stale, unavailable, manually observed states | implemented | Dreamfeed primitives | UI labels and state legend contract (`test/ui-contract.test.js`, `public/app.js`) |
| T29 | Stable layout, keyboard access, reduced motion, non-color labels, and local acknowledgement states; sub-100ms latency target requires a future measured benchmark | implemented | Dreamfeed guidelines | Design-system guidelines + manual browser checks; no automated a11y suite in this package; no latency benchmark claimed |
| T30 | Future persistence versioned, tenant scoped, exportable, non-authoritative | implemented | Cross-cutting requirements | `.dreamfeed/` control-plane sidecar (D31): schemaVersion field, app-owned, gitignored, never authority over source truth (`src/commands/store.js`); tenant scoping deferred to Phase 2 |
| T31 | Gate F legacy language reconciled to D23 | implemented | Gate F, D23 | Gate F, PS-002, roadmap, strategy, README, CLAUDE updates |
| T32 | External gates: design partners, legal entity, pricing, trademark, payments, public launch, Guild moderation remain blocked | deferred with explicit gate | Roadmap, D26b, scope | Gate register and disabled features |
| T33 | Governed memory: approved contextual aids with scoped retrieval, export, tombstones, and visible assistant context | implemented | D33 | `src/memory.js`, sidecar schema v2, lifecycle policy defaults; `test/memory.test.js`, `test/ui-contract.test.js` |
| T34 | Memory trust hardening: retrieval reasons, state/scope/tag filters, provenance inspector, stable export envelope, capped assistant context citations/warnings | implemented | D34 | `src/memory.js`, `src/server.js`, `public/app.js`; `test/memory.test.js`, `test/ui-contract.test.js` |
| T35 | Verification/release cockpit: approved verification records, release candidates, guarded export, founder-class shipped marking, provenance inspector | implemented | D35 | `src/release.js`, `src/server.js`, `public/app.js`; `test/release.test.js`, `test/ui-contract.test.js` |
