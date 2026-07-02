---
brand: Dreamfeed
document: Brand Brief (Structured Extraction)
date: 2026-06-21
status: Historical extraction — superseded in part, see post-resolution note below
scope: Dreamfeed-only brand extraction for logo strategy and design work
---

# Dreamfeed Brand Brief

> **Purpose:** Structured extraction from existing Dreamfeed source documents, for
> logo strategy and design work. Built from repo evidence first; gaps are labeled
> rather than invented. See `README.md` for the authority order governing these
> source documents.
>
> **Context note (resolved 2026-06-21):** Dreamfeed is a single brand object across
> its full lifecycle — today's Stakeport-internal cockpit (Phase 1) and the eventual
> standalone product/company (Phase 1.3 → Phase 2 spin-out, per
> `parallel-products/agentic-business-os/ROADMAP.md`). It is not two brands, and the
> name is not in flux. Stakeport's own branding is unaffected throughout.
>
> **Post-resolution note (2026-06-22):** This brief was written 2026-06-21, before a
> logo concept was selected and rendered. The questions it frames below as
> "Undecided" / "Must ask now" / "Blockers" regarding *whether* and *when* a mark
> should exist have since been resolved — see `decision_queue.md` D24/D25/D26a.
> A full combination-mark asset set ("Verified Node — Directional Revision") is
> now rendered and canonical; see `brand-guidelines.md` § Logo and
> `logo-concept-specs.md` for current status. The fields below are left as
> originally written (a point-in-time record of the pre-logo state) except where
> corrected inline and marked **[SUPERSEDED 2026-06-22]**.

## project_state

| Field | Value |
|---|---|
| company_name | Dreamfeed |
| legal_entity_name | Missing — runs inside the Stakeport OS repo today; ROADMAP.md states the Phase 2 spin-out will be "a separate entity from Stakeport (details TBD at Phase 2 planning)" |
| brand_or_product_name | Dreamfeed — single name across its full lifecycle; today's internal cockpit and tomorrow's standalone product are the same brand object, not two names converging |
| task_scope | Full identity / logo strategy for Dreamfeed, currently operating as an internal tool (Phase 1) designed from inception to spin out into its own standalone product and eventually separate company (Phase 2, per ROADMAP.md) |
| brand_change_type | New brand, early-but-permanent. Dreamfeed already has a name, a working visual system (`brand-guidelines.md`), and a live implementation (this repository). This is not a rebrand and not name-selection — it's extending an identity designed to outlast its current internal phase. |
| source_confidence | High — internal-phase brand system is fully specified and implemented; future-phase strategic/ICP positioning is specified in the three research files and is founder-endorsed as forward-looking material for this same brand. |

## source_inventory

| Source | Type | Status | Authority | Relevant findings |
|---|---|---|---|---|
| `README.md` | Documentation index / governance | Active | Tier 1 — authority order for all Dreamfeed docs; explicitly does not update the parent Stakeport brand | Dreamfeed = the Command Center UI alias and operating surface. Doc map and load conditions. Confirms scope is Dreamfeed-only, not parent-Stakeport. |
| `brand-guidelines.md` | Brand/visual guideline | Active companion draft — implemented | Tier 1 for Dreamfeed visual identity — this is Dreamfeed's own brand system, not inherited from Stakeport; the cockpit is a consumer of this system | Full color token set with exact hex values and contrast ratios; typography (IBM Plex Mono + structural sans, with legibility/homoglyph rules); Functional Green state-color rule; motion/flash/accessibility rules; explicit forbidden-pattern list; voice/tone register |
| `command-center-primitives.md` | Product/UX primitive spec | Active companion draft | Tier 1 for Dreamfeed's product architecture | Five persistent regions, typed object model, view registry, state model. "A polished visual identity that cannot explain regions, objects, views, and state ownership is not buildable enough" — likely extends to the spun-out product too. |
| `brand-architecture-updates-2026-06-21.md` | Changelog / contradiction-resolution patch | Applied | Tier 1 — corrections folded into `brand-guidelines.md` | Contrast-ratio fixes, Functional Green usage rule, IBM Plex Mono homoglyph spec, OCR/TeX cleanup. Confirms the brand system is actively maintained. |
| `brand-strategy-research.md` | Category design / competitive positioning research | Founder-endorsed strategic direction for Dreamfeed's future standalone-product phase | Primary for category/positioning/lexicon strategy | "Executive Tier" whitespace between "Commodity AI Slop" and "Bare-Metal Purist"; SCADA/aerospace/CAD/Bloomberg visual lineage rationale; verbal lexicon (Sovereign Execution, Topology of Leverage, Deterministic Runtime, Surgical Overrides); community-as-guild model. Same visual thesis already implemented in `brand-guidelines.md` — this is the rationale, the guidelines are the applied system. |
| `persona-icp-model.md` | ICP / buyer persona / GTM research | Founder-endorsed strategic direction for Dreamfeed's future standalone-product phase | Primary for who Dreamfeed serves once spun out | "Windows/macOS of the Agentic Era" framing — matches the existing positioning thesis in `parallel-products/agentic-business-os/STRATEGY.md`. ICP = Doer-Executive / Visionary Solo Operator. GTM pillars. Confirms continuity with the existing roadmap's Phase 1.3/Phase 2 non-technical-founder target. |
| `psychodynamic-brand-research.md` | Neuro-aesthetic / psychological design rationale | Founder-endorsed strategic direction; also already operationalized in `brand-guidelines.md` | Primary for emotional/visual rationale | Containment theory (Winnicott/Bion) justifying calm, non-impinging UI; chromatic stress-regulation rationale for the grey-canvas + amber-accent palette already shipped; typography ergonomics already reflected in the IBM Plex Mono rules. This is the "why" behind tokens that are already live. |
| `parallel-products/agentic-business-os/STRATEGY.md` + `ROADMAP.md` | Internal roadmap/strategy (Stakeport OS repo, non-governance) | Active, paused stage | Primary — defines Dreamfeed's official phase sequence and spin-out terms | Confirms three-phase sequence: Phase 1 (Stakeport-internal cockpit, in progress) → Phase 1.3 (IDE substitution) → Phase 2 (multi-tenant SaaS, separate legal entity, TBD monetization). Stakeport is "customer-zero" — a customer relationship, not a brand relationship. |

## company_context

- **core_offer** — Explicit, phase-dependent. *Today:* a read-only, localhost-only operating cockpit that parses governance markdown and surfaces live strategic state for coordinating the Stakeport OS build. *Future (Phase 1.3/2):* a visual operating system letting non-technical founders run an agentic, zero-headcount business — IDE substitution, then full multi-tenant SaaS.
- **target_customer** — Explicit, phase-dependent. *Today:* the founder, sole user, internal only. *Future:* the "Doer-Executive" / "Visionary Solo Operator" — domain-rich, syntax-poor solo founders and micro-VC-backed teams (1-2 humans), bootstrapped/pre-seed capital ($50K-$150K).
- **buyer** — Future-phase only; same as target customer (no buyer/user split — single-operator product).
- **category** — Explicit: "the Windows/macOS of the Agentic Era" — the GUI-native alternative to running an agentic business via VSCode + Claude Code (terminal-native path). Consistent across the internal roadmap and the research files, not a new claim.
- **market_position** — Explicit (future-phase): the "Executive Tier" — denser/calmer/more-governed than consumer AI tools, more visually structured and less labor-intensive than bare-metal terminal/IDE tools.
- **business_model** — Explicit for the eventual spin-out per ROADMAP.md: "Monetization: TBD — likely per-seat or per-org subscription." Weak inference from research files on pricing tolerance ($500–$2,000/month API/compute spend, framed as cheaper than a $150K/year engineer).
- **primary_value_proposition** — Explicit: "Stop Coding Your Business. Start Operating It." Internally (today's phase), the equivalent claim is operating-story-first clarity for daily OS-build coordination.
- **secondary_value_propositions** — Explicit: "The Zero-Headcount Enterprise"; resolving "vibe-coding anxiety" and the "black-box trust barrier" via deterministic, auditable, override-capable execution; 10:1 leverage over traditional team scaling (a genuine resonance with Stakeport's own operating-model language in `company-overview.md`, not a copy-paste).

## brand_strategy

- **brand_personality** — Calm, industrial, deterministic, high-stewardship, institutionally credible. Explicitly not magical, playful, or atmosphere-animated.
- **emotional_signal** — Psychodynamic "containment" (Bion) and "holding environment" (Winnicott) for an operator who may be solo — the brand absorbs operational chaos and returns calm, structured, legible representations.
- **business_signal** — Premium, executive-tier, institutional-grade infrastructure — explicitly the opposite of a disposable prototyping tool.
- **audience_expectations** — Linear/Vercel/Retool/Bloomberg-Terminal-caliber trust signals: real-time telemetry, compile-state visibility, instant rollback, absolute override capability.
- **category_conforming_vs_breaking** — Deliberately occupies unclaimed whitespace between two existing visual poles (consumer AI and bare-metal dev tooling).
- **conservative_vs_expressive** — Conservative/restrained by design, already implemented: grayscale/muted canvas, color reserved strictly for state signaling (≤5% of foveal display area), explicit forbidden-pattern list against gradients/glow/sparkles/glassmorphism.

## visual_context

- **existing_assets** — Explicit and substantial. A complete, implemented visual identity already ships in `tools/command-center/`: CSS token system (`--df-bg-canvas`, `--df-text-1/2/muted`, `--df-line`, `--df-panel`, `--df-panel-raised`, `--df-green`, `--df-cyan`, `--df-amber`, `--df-red`), full typography system (IBM Plex Mono + structural sans), motion/flash/accessibility rules, and a documented voice/tone register. **[SUPERSEDED 2026-06-22]** A logo/combination-mark now exists and is rendered ("Verified Node — Directional Revision") — see `brand-guidelines.md` § Logo and `logo-concept-specs.md`. *(Original 2026-06-21 text: "No logo, wordmark, or icon mark exists yet — this is the one missing layer of an otherwise complete brand system.")*
- **visual_preferences** — SCADA/HMI control-room aesthetics, aerospace telemetry (PFD-style), CAD/parametric tooling, Bloomberg Terminal density, elite developer infrastructure (Linear, Vercel, Retool); precise 1px grid lines, structural sans for labels, monospace tabular data.
- **visual_dislikes** — Extensive and explicit: cosmic/violet gradients, glassmorphism, glass orbs, iridescent nebula backgrounds, sparkles/magic-wand iconography ("Commodity AI Slop"); also explicitly rejects the opposite pole — raw black-terminal-only aesthetics with zero visual hierarchy ("Bare-Metal Purist").
- **required_usage_contexts** — Explicit for the current phase: the five persistent UI regions (sidebar, top command bar, main canvas, right inspector, bottom panel) defined in `command-center-primitives.md`. **None of the five regions currently reserve space for a logo/brand mark** — a genuine gap, not a hidden requirement already met.
- **small_size_requirements** — Missing for a logo mark specifically; explicit for UI typography (x-height, homoglyph differentiation, slashed zero, smallest supported UI size legibility).
- **motion_requirements** — Explicit for the broader UI (zero-lag <100ms transitions, restrictive flash-coding rules, reduced-motion equivalence) — would extend to any animated brand-mark state by the same constraints, though no source addresses a logo specifically.
- **color_constraints** — Explicit and locked: the exact token palette in `brand-guidelines.md` is Dreamfeed's own system. A logo/mark should very likely draw from this same palette rather than introduce a separate brand palette, since this is the one and only Dreamfeed brand system.
- **typography_constraints** — Explicit: IBM Plex Mono mandatory for command/path/ID/timestamp/schema/evidence surfaces; structural sans for labels/navigation/headers; weights ≥400 only; specific homoglyph and slashed-zero requirements.
- **shape_constraints** — Explicit for UI chrome (fine 1px lines, flat depth layers, no glassmorphism/glow/drop-shadow); research files suggest CAD/architectural-symbol iconography ("directional flow vectors, physical switch selectors, execution trace nodes") as a reasonable starting register for mark exploration, though not an explicit logo directive.

## constraints

**Required:**
- Logo/mark work must use or extend the existing `brand-guidelines.md` token system and typography — this is Dreamfeed's only brand system, not a parallel one to reconcile against.
- Must read as industrial/control-room/CAD-adjacent, not consumer-AI, consistent with the already-implemented visual system.
- Must not be presented as, or confused with, an update to the parent Stakeport brand system — Stakeport's own branding is unaffected and unchanged throughout this work.
- Any new visual element should tie to a state, command, object, file, source, timestamp, or decision per the existing Forbidden Patterns section — a logo mark is the allowable exception as a static identity element, but should not introduce decoration inconsistent with that ethic.

**Forbidden:**
- Purple gradients, glassmorphism, sparkles, magic-wand metaphors, "AI magic" language.
- Decorative glow, bokeh, aurora, orbital-node backgrounds, abstract intelligence marks.
- Generic SaaS register: seamless, unlock, empower, best-in-class, next-generation, enterprise-grade.
- Raw black-terminal-only aesthetic with zero visual hierarchy.

**Already decided:**
- Name: Dreamfeed — locked, single name across all phases.
- Full color token system, typography system, motion/flash rules, accessibility floor — already shipped and applied.
- Three-phase roadmap: Phase 1 (Stakeport-internal cockpit, in progress) → Phase 1.3 (IDE substitution) → Phase 2 (multi-tenant SaaS spin-out, separate legal entity).
- Stakeport's own branding is unaffected by any Dreamfeed brand/logo work, in either direction.
- Category positioning: "the Windows/macOS of the Agentic Era," the Executive Tier between commodity-AI and bare-metal-dev visual poles.

**Undecided:**
- ~~Whether a logo/wordmark/icon mark is needed now (Phase 1, internal-only, localhost) or should wait until closer to Phase 1.3/2 (external-facing).~~ **[RESOLVED 2026-06-22 — D24]** Locked now; full SaaS-standard asset set rendered.
- ~~If needed now: what surface it first appears on, since none of the five persistent UI regions currently reserve space for one.~~ **[Still open]** This specific placement-in-UI question was not resolved by D24/D25/D26a (those covered the mark's design and rendering, not its in-cockpit placement) — see `logo-concept-specs.md` for asset inventory; in-UI placement remains a separate, smaller open item.
- Legal entity formation and naming-collision/trademark clearance for "Dreamfeed" as a standalone company name (ROADMAP.md notes this is "TBD at Phase 2 planning") — **still open**, tracked as D26b.
- Monetization model for the eventual SaaS spin-out — not logo-relevant directly, but may affect pricing-page-adjacent brand surfaces eventually.

**Legal or trademark:** Missing — no trademark search or clearance has been done for "Dreamfeed." ROADMAP.md flags legal entity structure as TBD at Phase 2 planning, which would be the natural point to also clear the name.

**Phase or scope:** Explicit — Dreamfeed is currently Phase 1 (Stakeport-internal, localhost-only, read-only); logo/identity work is being scoped now, ahead of Phase 1.3/2, which is reasonable given the brand system itself is already built to last across all three phases.

## contradiction_log

| Issue | Source A | Source B | Severity | Recommended resolution |
|---|---|---|---|---|
| Resolved in session 2026-06-21: a prior pass incorrectly inferred that Dreamfeed (internal cockpit) and the entity described in the three research files were two different brand objects requiring reconciliation or a name choice. | `README.md` / `command-center-primitives.md` — internal, localhost-only, founder-as-sole-user framing | Research files — external commercial ICP, GTM apparatus, category-creation language | Resolved | Not a contradiction once `parallel-products/agentic-business-os/STRATEGY.md` and `ROADMAP.md` are read: those files already establish the Command Center is Phase 1 of the same product that becomes Phase 1.3 and Phase 2. Same brand, sequential phases. Recommend adding one cross-reference line in `README.md` pointing to the roadmap, since a reader of `docs/dreamfeed/` alone could plausibly re-derive the same false contradiction. |

## interview_map

> **[RESOLVED 2026-06-22]** The interview this section called for happened; both
> questions below were answered (start now, full SaaS asset set, founder-driven
> symbol selection via design-psychology-informed narrowing). Left as-written
> below as the historical record of what was asked.

**Must ask now (asked and answered 2026-06-22):**
- Should logo/mark work start now (Phase 1), or is it premature given Dreamfeed is still localhost-only and internal — would the founder rather defer visual-identity-mark work until closer to Phase 1.3? → **Answer: start now.**
- If starting now: what is the first real surface for a mark — app shell header/favicon inside the cockpit, or is this purely forward-looking work for the eventual external product? → **Answer: full SaaS-standard asset set, designed for external first-impression credibility even though MVP launch is still internal.**

**Ask if ambiguity remains:**
- Should the mark be a wordmark only (leaning on the existing IBM Plex Mono / structural-sans typography), a symbol-only mark, or a combination lockup?
- Does the founder want the mark's iconography to lean into the CAD/architectural-symbol register suggested by the research, or pursue a different concept within the same Executive Tier constraints?

**Defer until concept review:**
- Specific symbol/glyph direction.
- Favicon/app-icon simplification of any chosen mark.
- Whether the mark needs a light-canvas variant in addition to the dark-canvas system already specified.

**Answerable from documents:**
- Full color token values and contrast requirements (locked).
- Forbidden visual patterns (definitive negative-space list).
- Voice/tone register for any tagline or wordmark companion copy.
- Category positioning and ICP for the future-facing brand expression.
- Three-phase roadmap and spin-out terms.

## logo_readiness

> **[SUPERSEDED 2026-06-22]** This score and blocker list describe the pre-render
> state (2026-06-21). The mark has since been selected, rendered, and accepted —
> see `decision_queue.md` D24/D25/D26a. Remaining open items are now tracked as
> D26b (trademark/resemblance clearance) and D26c (print/raster exports), not as
> "logo readiness" in the original sense of this section.

**Score (historical, 2026-06-21): 80 / 100** — superseded; the mark now exists.

**Blockers (historical, 2026-06-21 — for current blockers see D26b/D26c):**
- No logo/mark surface currently reserved in the five-region UI model — needs a placement decision before a mark can be implemented in the actual cockpit UI. **Still open** — D24/D25/D26a resolved the mark's design and rendering, not its in-cockpit placement. Matches the still-open item in `constraints.Undecided` above; not tracked under a D-number yet.
- ~~No trademark/legal clearance done for "Dreamfeed" as an eventual standalone company name.~~ Still genuinely open — tracked as D26b, not resolved by rendering.
- ~~No decision on whether to start mark design now (Phase 1) or closer to the external-facing phases (Phase 1.3/2).~~ **Resolved** — start now (D24).

**Enough to start interview:** Yes.
