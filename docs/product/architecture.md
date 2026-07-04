# Dreamfeed product reference architecture

Status: implementation contract for the local reference package

Date: 2026-06-23

## Purpose and boundary

Dreamfeed has one brand lifecycle: the current Stakeport-internal Command
Center, the Phase 1.3 project workspace, and the eventual Phase 2 product are
one brand. The current Command Center is a separately deployed, read-only, localhost-only
customer-zero reference — extracted to `c:\Projects\dreamfeed-command-center`
(D29 resolved 2026-07-01; was at `tools/command-center/`). This package does
not add a write path to that server, alter its six-object parser, or use its
API as an execution transport.

The product reference lives in `parallel-products/agentic-business-os/`. It is
portable by copying that directory. Its runtime is local-only and dependency
free. A future hosted control plane may replace its in-memory adapters only
after the Phase 1.3 and Phase 2 gates below are evidenced.

## Phased architecture

| Phase | Local reference implementation | Explicitly excluded |
|---|---|---|
| 1.3 | Authorized local project selection, read-scoped source inspection, proposed-edit/diff review, policy-scoped plan/approval/run lifecycle, immutable in-memory ledger, controlled test command, halt and rollback for fixture-safe mutations | Remote credential use, unrestricted shell, deployment, commit/branch mutation, persistence, public service |
| 1.3 validation | Two synthetic fixture projects, onboarding guide, acceptance script, feedback capture schema, and a measurable non-VS-Code/non-Claude-Code protocol | Claiming an external design partner or Phase 2 eligibility |
| 2 reference | Organization/workspace/project/repository control-plane model, membership/roles, tenant-isolated projections, encrypted in-memory secret vault, entitlements, import/export and migration adapters | Public hosting, customer identity, payment collection, legal/entity claims, production launch |
| post-launch prototype | Executive profiles, model controls, budgets, decision/ticket queue, release/sprint records, onboarding/review, opt-in Guild model | Cross-tenant sharing, autonomous execution, moderation bypass, commercial enablement |

## Data ownership model

| Data class | Canonical owner | Product treatment | Prohibited treatment |
|---|---|---|---|
| Source and governance files | Selected repository | Read by a project-scoped source adapter; proposed edits identify path, base hash, and diff | Copying into another project, silently treating index data as truth |
| V1 six-object projection | `c:\Projects\dreamfeed-command-center` parser (extracted D29 2026-07-01) | Remains source-backed and unchanged | Executing from the V1 API or modifying its source maps |
| Project index/cache | Project-scoped control-plane projection | Ephemeral, labelled derived/cached, rebuilt per grant | Shared between projects or treated as canonical |
| UI/editor state | Current project/workspace session | In memory in the reference; later persistence requires schema version, tenant scope, export, and no authority over source truth | Browser storage that silently changes source-backed state |
| Policy, approval, run, trace, artifact | Product control plane | Tenant/workspace/project scoped records with actor, time, source authority, and immutable event sequence | Writing into the source repository as hidden governance truth |
| Credentials | Secret vault | Encrypted in memory, redacted from traces and exports, never written to source repositories | Plaintext persistence, trace logging, cross-tenant lookup |
| Usage and entitlements | Product control plane | Plan-agnostic feature gates and metering records | Invented prices, payment collection, or legal plan claims |

## Object contracts

The control plane uses these first-class types: `Organization`, `Workspace`,
`Project`, `Repository`, `Agent`, `Skill`, `Policy`, `Plan`, `Approval`, `Run`,
`TraceEvent`, `Artifact`, `Environment`, `Connector`, and `Entitlement`.

The post-launch prototype adds `ExecutivePerformanceProfile`, `ModelSelection`,
`UsageBudget`, `DecisionTicket`, `Release`, `Sprint`, `OnboardingReview`, and
`GuildMembership`/`GuildShare`.

Every product record includes an immutable ID, tenant/workspace/project scope
where applicable, state, source authority, timestamps, and relationship IDs.
The Phase 1 Command Center six-object model remains independent and unchanged.
Adapters may project a source object into a product `Artifact` or `SourceFile`,
but may not relabel it as a different canonical object.

## Project selection contract

1. A selection begins as an explicit authorization request for one user-entered
   folder. The server resolves it with `realpath` and verifies it is inside a
   configured allowed root. It does not scan parent directories or select a
   sibling on failure.
2. A project grant records the canonical path, read/write scope, trust state,
   Git status, branch when available, and supported project signals. A non-Git
   directory is a valid inspect-only project.
3. Every source lookup is resolved relative to the selected project root,
   rejects traversal and symlink escapes, and is constrained by a text-file
   allowlist and size cap.
4. Switching projects changes the active project ID; all queries require that
   scope. Closing a project clears the active selection. No fallback project
   exists.
5. Remote repositories require a named connector and an explicit authorization
   record. This reference exposes the denied/pending state only; it does not
   accept or retain remote credentials.

## Governed execution lifecycle

```
request -> plan -> review -> explicit approval -> run -> immutable trace
                                             |             |
                                             +-> deny       +-> halt / rollback
```

- A request is declarative and cannot mutate a project.
- A plan binds a project ID, policy ID/version, requested operation, source
  base hash, expected diff, approved command allowlist, and rollback strategy.
- Approval is explicit, actor-attributed, project-scoped, and binds the plan
  hash. Any changed source hash invalidates approval.
- Execution accepts only an approved plan and a policy permitting its exact
  operation. The reference allows fixture-safe `write-file` and `node --test`
  operations. It never passes arbitrary text to a shell.
- Each state transition appends a frozen ledger event. A failed run preserves
  evidence, offers halt, and permits rollback only when the plan captured a
  rollback preimage and policy allows it.
- Overrides (`pause`, `resume`, `halt`, `rollback`) append actor, input,
  timestamp, prior/result state, and source authority. They cannot edit prior
  events.

## Interface contracts

The reference server binds `127.0.0.1` only. Its static files are served only
from an explicit route map with fixed MIME values. Its JSON API is separate from
the V1 Command Center API:

| Route family | Responsibility | Key denial behavior |
|---|---|---|
| `GET /api/session` | Active project, branch, trust, access scope, feature gates | No active project returns an explicit empty state |
| `POST /api/projects/authorize` | Canonicalize and grant one local project under an allowed root | Invalid/unreadable/outside/symlink escape return stable denial codes; no fallback |
| `POST /api/projects/select` / `close` | Switch or clear an authorized project | Unknown project has no metadata leak |
| `GET /api/projects/:id/files` / `file` | Project-scoped listing and text inspection | Traversal, binary, oversized, or cross-project paths are denied |
| `POST /api/requests`, `plans`, `approvals`, `runs` | Governed lifecycle only | Missing policy, approval, hash, grant, or entitlement is denied safely |
| `POST /api/runs/:id/halt` / `rollback` | Controlled lifecycle overrides | Wrong scope, terminal run, absent preimage, or policy denial is explicit |
| `GET /api/trace` / `diff` / `health` | Read-only evidence, source status, branch/diff/build state | Cross-project and cross-tenant queries return the same non-disclosing denial |
| `POST /api/connector-requests` | Records a pending remote connector authorization | No credential material accepted or returned |

The Phase 2 control-plane adapter uses direct module calls in the reference,
not a public network API. It enforces the same scope checks before every read,
write, export, connector, secret, entitlement, or Guild operation.

## Isolation and secret handling

Scope is never inferred from a path or object ID alone. Each lookup receives
`organizationId`, `workspaceId`, and, when relevant, `projectId`. The lookup
matches all supplied scope IDs before returning data. Unknown and unauthorized
objects use the same `NOT_FOUND_OR_DENIED` response to prevent metadata
enumeration.

Secrets use AES-256-GCM with a process-supplied master key. The vault stores
ciphertext, IV, and authentication tag; exports omit secret records; trace
normalization redacts values by construction. The reference key is generated
only for in-memory test/runtime use. A production key-management design is an
explicit Phase 2 security gate, not implied by this reference.

## Migration and portability

1. Keep the Stakeport Command Center running unchanged as customer-zero.
2. Import a repository through `createWorkspace` and `authorizeProject`; do
   not copy its sources into the control plane.
3. Create derived source indexes on demand. Migration imports source references,
   not hidden duplicate truth.
4. Export control-plane records as versioned JSON with tenant/project scope;
   omit credentials and require a new connector authorization on import.
5. Stakeport migrates through this same importer with a new Organization and
   Workspace, then reauthorizes its existing repository root. No privileged
   migration path exists.

## Threat model and mitigations

| Threat | Primary mitigation | Verification |
|---|---|---|
| Path traversal or parent-directory indexing | `realpath`, allowed-root containment, per-project safe resolution, no fallback | Unit and HTTP tests |
| Symlink escape | Compare real target against granted root for every file access | Unit tests |
| Cross-project/tenant leakage or inference | Mandatory scope filter; identical non-disclosing denial | Isolation tests |
| Unapproved execution | Plan hash + explicit approval + policy scope + feature gate | Lifecycle tests |
| Arbitrary shell/deploy escalation | Fixed operation and command allowlists; deploy entitlement disabled | Policy tests |
| Approval replay after source change | Base-source hash is rechecked before run | Mutation/approval tests |
| Ledger tampering | Append-only frozen event records; no update API | Immutability tests |
| Failed mutation leaves unknown state | Captured preimage, halted state, constrained rollback | Failure/halt/rollback tests |
| Credential disclosure | In-memory AES-GCM vault, trace redaction, export omission | Secret/export tests |
| Static-file exposure | Explicit route allowlist and MIME map; no `docs/` mapping | HTTP asset-security tests |
| UI ambiguity/accessibility regression | Five regions, text state labels, focus styles, reduced-motion CSS, stable reserved panes | Browser checks |

## Gates and evidence

| Gate | Status | Evidence required to move it |
|---|---|---|
| Phase 1 Command Center / Gate C | Preserved | Existing parser/object/provenance regression suite remains green |
| Gate F wording | Reconciled as historical UX constraint, not a separate-brand rule | D23 single-brand decision and this product boundary remain consistent |
| **PS-003 / Gate G write envelope (D31)** | **Open — first slice implemented 2026-07-03** | Governed lifecycle (intent → plan → approval → execute → ledger) implemented in this package: `src/commands/*`, `src/write.js`, native schema + queue, safe named git actions, assistant adapter. Evidence: `test/constraints.test.js`, `test/write-guards.test.js`, `test/ledger.test.js`, `test/readiness.test.js`. Remaining Phase 1.3 surface (proposed file edits, branch-management UI, deploy triggers, free-form terminal) stays gated |
| Phase 1.3 external validation | Blocked | Evidence from two real non-Stakeport organizations using the acceptance protocol |
| Phase 2 launch | Blocked | Three or more validated organizations plus approved security, legal, trademark, and commercial evidence |
| Remote execution/deploy | Disabled | Approved connector, policy, entitlement, environment, and execution safety evidence |
| Billing/payments | Disabled | Approved pricing, legal entity, payments, and commercial controls |
| Guild sharing/autonomy | Disabled | Tenant isolation, privacy, moderation, safety, commercial, and founder approval evidence |
| Public distribution | Disabled | Trademark/resemblance clearance, legal entity, security, and launch approval |
