# Agentic-Business OS — Roadmap

> **Status:** Active local reference build — Stakeport remains customer-zero.
> The Phase 1.3/2 reference implementation is local-only and gated; it does
> not claim external validation, commercial readiness, or public availability.

---

## What This Is

Dreamfeed is the Agentic-Business OS product (and eventual separate company)
that generalizes the Stakeport OS operating model for non-technical founders
running agentic businesses. Stakeport is customer-zero — the institutional
business that proves the model works on a real operating business before the
product is offered to others.

The Dreamfeed Stakeport OS Command Center is Phase 1 of this product, built as
Stakeport's own internal tool first. **D29 resolved 2026-07-01:** extracted to
`c:\Projects\dreamfeed-command-center` (was at `tools/command-center/`). D23 resolves the
identity boundary: the internal cockpit and future standalone product are one
Dreamfeed brand lifecycle; Stakeport's public brand remains separate.

---

## Phase Sequence

### Phase 1 — Founder Operating Cockpit (Stakeport-internal, in progress)
Read-only command center that parses OS markdown tracking files
(governance-schema frontmatter, pull architecture) and surfaces live
strategic state: initiative status, weekly priorities, decisions queue,
blocked items, dispatch queue. Originally built inside the Stakeport OS repo;
extracted to this standalone repository (D29, 2026-07-01) — Stakeport is now
selected at runtime via the Project picker.

**Source:** `c:\Projects\dreamfeed-command-center` (extracted D29 2026-07-01; was at `tools/command-center/`)
**Tracking:** Stakeport OS `strategic_initiatives.md` — "Build Stakeport OS Command Center"
**Gate to Phase 1.3:** The Phase 1 cockpit is live and wired against real parsed
data. A founder-directed local Phase 1.3 reference build may proceed without
representing Brief B gate 5b as accepted or the product as externally validated.

---

### Phase 1.3 — IDE Substitution (non-technical founder surface)

> **Status 2026-07-07:** first slice **in progress under D31 (PS-003 / Gate G)**
> in the standalone repo — governed write lifecycle, Dreamfeed-native
> Goals/Operations schema, daily execution queue, approval dialog, assistant
> dock, safe named git actions, governed memory, and D34 memory trust hardening
> are implemented. D35 adds local verification/release evidence records and
> release candidates. Proposed file edits, branch-management UI, deploy
> triggers, public release creation, and free-form terminal remain gated (D36+
> candidates — D32 landed 2026-07-06 as the topology/discovery/promotion
> adoption bridge; D33/D34 landed governed memory and memory inspection
> hardening).
Replaces the VSCode + Claude Code workflow for non-technical founders.
The command center gains file editing, diff review, branch management,
commit/build/test visibility, deploy triggers, and terminal access —
all surfaced through a GUI rather than a text editor and terminal.

**Target operator:** Non-technical founders running an agentic business who
cannot or do not want to operate in VSCode + Claude Code directly.

**Gate to Phase 2:** Phase 1.3 is validated on at least two non-Stakeport
businesses (design partners) running their own agentic OS.

**Reference status (2026-06-23):** local project selection, governed lifecycle,
fixture validation kit, and isolation tests are implementation work only.
Synthetic fixtures are not design-partner evidence.

---

### Phase 2 — Multi-Tenant Agentic-Business OS SaaS (spin-out)
The product may ship as a SaaS platform for agentic-org founders only after its
launch gate is evidenced. The local control-plane reference is not a SaaS launch.
Each customer runs their own OS instance — governance schema, agent registry,
weekly priority-setting, goal-setting, cockpit — on the same infrastructure.
Stakeport becomes a paying customer of its own product.

**Legal:** Separate entity from Stakeport (details TBD at Phase 2 planning).
**Monetization:** TBD — likely per-seat or per-org subscription.
**Gate to launch:** 3+ design-partner orgs on Phase 1.3, demonstrating
the IDE-substitution surface works without founder coding background.

**Reference status (2026-06-23):** tenancy, import/export, entitlement, secret,
and Guild data models are internally testable. No cloud resources, accounts,
payments, legal entity, or public service are created by this work.
