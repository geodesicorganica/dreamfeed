# Dreamfeed traceability matrix

Status labels are deliberately narrow: `implemented` means covered by code and
verification in this package; `deferred with explicit gate` means it is blocked
by named external evidence; `not applicable` means it is prohibited for this
reference. The matrix is updated with each vertical slice.

| ID | Requirement | Status | Source | Verification evidence |
|---|---|---|---|---|
| T01 | One Dreamfeed brand from internal cockpit through spin-out | implemented | D23, `docs/dreamfeed/brand-guidelines.md` | Governance reconciliation references |
| T02 | Preserve Stakeport public brand separation | implemented | D23, Dreamfeed README | No parent-brand mutation; scope docs |
| T03 | Preserve V1 six objects, IDs, provenance, freshness, topology, viewer protections, GET-only, localhost, memory boundary | implemented | PS-002, Gate C/F | Command Center regression suite (42 baseline tests) |
| T04 | Five regions, shared object identity, lens registry, Inspector, trace panel, local assets/fonts | implemented | Dreamfeed primitives | Existing Command Center UI contract/browser checks |
| T05 | Local project selection with canonical paths and trusted grant scope | implemented | Phase 1.3 scope | `project-registry` tests |
| T06 | Git metadata/signals; non-Git inspect-only state | implemented | Phase 1.3 scope | Fixture Git/non-Git tests |
| T07 | No parent scanning, fallback, or unapproved execution | implemented | Architecture §Project selection | Project-denial tests |
| T08 | Explicit remote connector authorization with no repository credentials | implemented | Phase 1.3 scope | Connector route rejects credential material; control-plane test |
| T09 | Project-scoped indexes, UI state, policies, traces, artifacts, credentials | implemented | Data ownership model | Active-project and tenant-isolation tests |
| T10 | Source browsing, proposed editing, diff/branch/test/deploy visibility, controlled direct instruction | implemented | Phase 1.3 scope | Browser governed-workflow check; HTTP lifecycle test |
| T11 | Portable Agent/Skill/Policy/Plan/Approval/Run/Trace/Artifact/Environment/Connector concepts | implemented | Phase 1.3 scope | First-class object/control-plane tests |
| T12 | Request → plan → review → approval → execution → immutable trace | implemented | Phase 1.3 scope | TDD lifecycle and browser checks |
| T13 | Least privilege, confirmation, pause/resume/halt/rollback, visual ledger | implemented | Architecture §Lifecycle | Policy, halt, rollback, deep-immutability tests |
| T14 | Fixture workspace, onboarding, acceptance script, feedback capture, non-VS-Code protocol | implemented | Phase 1.3 scope | `validation-kit/` artifacts |
| T15 | Do not claim external partner validation | deferred with explicit gate | Roadmap Phase 1.3 | Two real partner evidence records |
| T16 | Self-contained relocation-ready Phase 2 product package | implemented | Phase 2 scope | Dependency-free package-local source, fixtures, docs, and test suite |
| T17 | Organization/workspace/project/repository and all governance/execution/entitlement objects | implemented | Phase 2 scope | Control-plane first-class object tests |
| T18 | Source vs control-plane ownership and Stakeport standard import | implemented | Architecture §Data ownership/migration | Versioned import/export test |
| T19 | Membership, roles, provisioning, tenant isolation, connector least privilege, encrypted secrets, audit, observability, retention | implemented | Phase 2 scope | Tenant/secret/audit tests and operations policy |
| T20 | Plan-agnostic billing/entitlement; no payments or invented pricing | implemented | Phase 2 scope | Default-disabled entitlement tests; no payment integration |
| T21 | Threat model, retention, incident/rollback, production-readiness runbooks | implemented | Phase 2 scope | Architecture and `security-and-operations.md` |
| T22 | No deployment, cloud, external accounts, or SaaS readiness claim | not applicable | Scope prohibition | No provider SDK/config; feature gates |
| T23 | Executive profiles, model selection, budgets, decision/ticket, release/sprint, onboarding/review | implemented | Track 3 scope | Executive prototype object tests |
| T24 | Opt-in, isolated, moderated, auditable Guild prototype | implemented | Track 3 scope | Opt-in membership and default-denial test |
| T25 | No default cross-tenant code, prompts, traces, artifacts, metadata, credentials, or business-data sharing | implemented | Track 3 scope | Non-disclosing tenant/project isolation tests |
| T26 | Gate advanced execution and Guild features | implemented | Track 3 scope | Default-disabled entitlement tests |
| T27 | Safe asset routes, MIME checks, no CDN/runtime traversal/static docs exposure | implemented | Cross-cutting requirements | HTTP static-allowlist test |
| T28 | Visibly distinct source, derived, candidate, cache, live, stale, unavailable, manually observed states | implemented | Dreamfeed primitives | UI labels and state legend contract |
| T29 | Stable layout, keyboard access, reduced motion, non-color labels, and local acknowledgement states; sub-100ms latency target requires a future measured benchmark | implemented | Dreamfeed guidelines | Browser desktop/narrow checks and CSS contract; no latency benchmark claimed |
| T30 | Future persistence versioned, tenant scoped, exportable, non-authoritative | implemented | Cross-cutting requirements | Architecture §Data ownership; reference remains in-memory |
| T31 | Gate F legacy language reconciled to D23 | implemented | Gate F, D23 | Gate F, PS-002, roadmap, strategy, README, CLAUDE updates |
| T32 | External gates: design partners, legal entity, pricing, trademark, payments, public launch, Guild moderation remain blocked | deferred with explicit gate | Roadmap, D26b, scope | Gate register and disabled features |
