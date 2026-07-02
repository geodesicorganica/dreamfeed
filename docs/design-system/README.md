# Dreamfeed Design System

Dreamfeed is the **Command Center** — a mission-critical operating cockpit for a
single high-leverage operator (the "Doer-Executive"). It is the visual identity
and operating surface for the internal Stakeport OS build today (Phase 1,
localhost-only, read-only), designed from inception to spin out into a standalone
agentic-business operating system (Phase 1.3 → Phase 2).

> Category positioning: **the Executive Tier** — denser and calmer than consumer
> AI tools, more visually structured than bare-metal terminals. The reference
> lineage is SCADA/HMI control rooms, aerospace telemetry, CAD, the Bloomberg
> Terminal, and elite developer infrastructure (Linear, Vercel, Retool).

Dreamfeed is **not** consumer AI. It must never look magical, playful, animated
for atmosphere, or optimized for a marketing hero.

---

## Source material

This system was extracted from the founder-approved Dreamfeed brand docs.
The reader is not assumed to have the stakeport_os repo; references are stored
for those who do. Current locations in this repo:

| Source doc | What it governs |
|---|---|
| `../brand/brand-guidelines.md` | Locked color tokens (exact hex + contrast), typography rules, Functional Green, alert colors, motion/flash, voice, forbidden patterns |
| `../product/command-center-primitives.md` | Five persistent regions, typed object model, view registry, three-layer state model |
| `../brand/brand-architecture-updates.md` | Applied contrast fixes (`--df-text-2/-muted`), Functional Green rule, IBM Plex Mono homoglyph spec |
| `../brand/brand-brief.md` | Structured brand extraction; logo readiness |
| `../brand/logo-concept-specs.md` | Five logo concepts; **Concept 3 "Verified Node — Directional Revision" selected 2026-06-21** |
| `../brand/research/brand-strategy-research.md` | Category design, Executive-Tier whitespace, Linguistic Taxonomy/lexicon |
| `../brand/research/persona-icp-model.md` | Doer-Executive ICP, frictions, buying insight |
| `../brand/research/psychodynamic-brand-research.md` | Containment rationale behind the calm grey-canvas + amber-accent palette |

**Authority order:** founder-approved Command Center specs → these Dreamfeed docs
→ implementation evidence in `c:\Projects\dreamfeed-command-center` → parent Stakeport brand
(only when inheritance is explicitly requested). Dreamfeed brand work never
updates the parent Stakeport brand.

---

## CONTENT FUNDAMENTALS

Dreamfeed copy uses the **Linguistic Taxonomy**: an industrial, diagnostic
register centered on systems stewardship, topology, deterministic runtime, and
capital leverage. The voice reports conditions; it does not reassure.

- **Tone:** calm, industrial, deterministic, high-stewardship, institutionally
  credible. Never magical, hype-y, or apologetic.
- **Person:** address the operator's *system*, not the operator. Prefer
  object-and-state statements ("Validation failed — `trace.json`, step 4") over
  "you" / "we" conversational framing. No first-person assistant persona.
- **Casing:** Sentence case for prose and labels. **UPPERCASE** reserved for
  small structural overlines (region headers) and state tokens (`LIVE`,
  `BLOCKED`, `VERIFIED`). Monospace for any source-backed value.
- **Every operational message names:** the state, the affected object/module,
  the source/cause, the timestamp/freshness, and the next available action.
  Error messages identify root cause + affected scope *before* proposing a fix.
- **Lexicon (use only when the mechanism exists):** Sovereign Execution,
  Topology of Leverage, Deterministic Runtime, High-Stewardship Architecture,
  Surgical Overrides, Contextual Integrity, Visual Ledger, Execution Trace Map.
- **Emoji:** none. **Exclamation marks:** none.
- **Banned:** "magic", "AI-powered", "seamless", "unlock", "empower",
  "best-in-class", "next-generation", "enterprise-grade", "Oops!", "Sorry",
  "Something went wrong" (without a diagnosis).

Examples:
- ✅ `BLOCKED — rev-08 trace schema review. DF-LIVE-ROLLBACK-001 missing affected-step field. 14:01:55Z. Action: patch schema/trace.json.`
- ✅ `Audit passed · src/regions/inspector.tsx · 14:02:09Z`
- ❌ `Oops! Something went wrong ✨ — try again!`
- ❌ `Unlock seamless, AI-powered automation.`

---

## VISUAL FOUNDATIONS

**Canvas & color.** A single deep-grey canvas (`#202426`) with three flat depth
planes — canvas < panel (`#272C2E`) < raised (`#303638`) — separated by 1px
hairlines (`#3B4142`). Depth is signalled by plane + line, **never** by shadow,
glow, or glassmorphism. Color is a *functional state signal only* and is kept
within ~5% of foveal area: green = verified/live record states, amber =
observe/active/queue, red = halt/failure, cyan = informational/selection.
A `raised` surface means an active command/inspection/trace context — not a
decorative card.

**Typography.** IBM Plex Mono for all source-backed data (commands, paths, IDs,
timestamps, schema, logs) with slashed zero + disambiguated homoglyphs; IBM Plex
Sans (neo-grotesque structural sans) for labels, region headers, navigation.
Weights ≥400 only (thin strokes are prohibited — they degrade foveal parsing).
Line height 140–150% on multi-line operational text. No viewport-scaled type,
no negative letter-spacing. Numerals are tabular for aligned data.

**Spacing & layout.** 4px base unit; dense by design. The product is built on
**five persistent regions** (sidebar, top command bar, main canvas, right
inspector, bottom panel) whose mental model never moves. Layout is
deterministic — loading/empty/stale/error states occupy the same reserved space
as resolved content so the operator's pointer target never shifts.

**Backgrounds.** No imagery, gradients, or textures on chrome. The only
"background" motif is a faint 1px CAD reference grid on the Topology canvas.
Full-bleed photography is not part of the system.

**Corners, borders, cards.** Square-leaning radii (0–4px); the 1px line is the
primary structural device. "Cards" are flat panels with a hairline border and a
small radius — never rounded pills with colored left-borders, never repeated
identical metadata cards.

**Shadows.** None on persistent chrome. The only allowed shadows are restrained
overlay shadows for genuinely transient floating surfaces (menus, dialogs,
toasts). Inputs use a subtle inset to seat them in their sunken well.

**Motion.** Crisp local acknowledgement under 100ms; `cubic-bezier(0.2,0,0.2,1)`,
80–160ms. No springy, soft, or atmospheric animation. Flashing/pulsing is allowed
**only** for mission-critical alerts (3–5Hz critical, ≤2Hz queue-delay), always
with an Alert Interlock (motion stops on focus/hover) and a simultaneous
non-flashing text equivalent. Respect `prefers-reduced-motion`.

**State & interaction.** Hover = a one-step lighter plane (transparent →
panel → raised). Press/active = a held lighter plane + (for toggles) knob
position. Focus = a visible cyan ring (always present for keyboard nav). Color
is **never** the only state indicator — every state carries explicit text.

**Imagery vibe.** Cool neutral greys; no warmth, no grain, no photography.
The aesthetic is instrument-panel, not editorial.

---

## ICONOGRAPHY

The Dreamfeed brand register calls for **architectural / control-room symbols**:
directional flow vectors, physical switch selectors, execution-trace nodes,
file/branch/topology glyphs. Explicitly forbidden: sparkles, magic wands, stars,
glowing lightbulbs, abstract "intelligence" marks.

- **No bespoke icon set ships in the brand yet.** This system uses
  **[Lucide](https://lucide.dev)** (geometric line icons, even ~1.75px stroke)
  via CDN as the closest match to the CAD/SCADA register —
  **flagged as a substitution.** Replace with a commissioned set when available.
  Load: `<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js">`
  then `lucide.createIcons({ attrs: { 'stroke-width': 1.75 } })`; markup is
  `<i data-lucide="share-2"></i>`. Curated set in `guidelines/brand-iconography.html`.
- **State dots** (small filled circles in a functional color) are the system's
  most-used "icon" — always paired with a text label.
- **Emoji / unicode-as-icon:** not used.
- **Logo / brand mark:** the **Verified Node** (Concept 3). Constructed SVGs in
  `assets/` (`logo-mark.svg`, `logo-mark-light.svg`, `logo-lockup.svg`,
  `favicon.svg`) — a filled core node (Primary Text) inside a 260° Operational
  Amber confirming ring whose 100° gap opens on the 1:30 (upper-right) vector,
  with butt-cap terminals. Built from the construction spec, not a rendered file
  the founder approved — see Caveats.

---

## Index / manifest

**Root**
- `styles.css` — global entry point (consumers link this). `@import` lines only.
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `elevation.css`
- `assets/` — `logo-mark.svg`, `logo-mark-light.svg`, `logo-lockup.svg`, `favicon.svg`
- `README.md` (this file) · `SKILL.md` (portable Agent Skill)

**Components** (`window.DreamfeedDesignSystem_7401df`)
- `components/core/` — `Button`, `IconButton`, `Panel`, `Badge`
- `components/status/` — `StatePill`, `TraceRow`, `KeyValue`
- `components/forms/` — `TextField`, `Select`, `Switch`
- `components/navigation/` — `Tabs`

**Foundation cards** (`guidelines/`) — Colors, Type, Spacing, Brand specimens
shown in the Design System tab.

**UI kit** (`ui-kits/command-center/`) — interactive cockpit recreation: five
persistent regions + Dashboard / Topology / IDE / Table lenses over one typed
object model. Entry: `ui-kits/command-center/index.html`.

---

## Caveats

- **Fonts** are loaded from Google Fonts (IBM Plex Mono + IBM Plex Sans, the
  brand-canonical typefaces). No local `@font-face` binaries are bundled — swap
  to self-hosted files for offline/production use if required.
- **Iconography** uses Lucide as a flagged substitution (no brand icon set exists).
- **Logo** is built from the written construction spec (`../brand/logo-concept-specs.md`);
  it has not yet been through the founder's render-production + trademark step.
