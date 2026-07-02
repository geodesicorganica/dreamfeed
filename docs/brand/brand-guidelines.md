---
brand: Dreamfeed
document: Brand Guidelines
date: 2026-06-22
status: Active companion draft — see README.md for the full folder index
scope: Dreamfeed-only interface brand guidance
---

# Dreamfeed Brand Guidelines

Dreamfeed is the standalone Command Center UI alias and operating surface for
the internal Stakeport OS cockpit — designed from inception to spin out into
a standalone product (Phase 1.3 → Phase 2, per
`docs/product/roadmap.md`). These guidelines govern
Dreamfeed UI and documentation artifacts only. They do not update the parent
Stakeport brand system.

> For the full index of this folder's documents (logo spec, brand brief,
> rendered assets, research files), see `README.md` § Document Map — this
> file covers visual tokens, typography, color/motion rules, and the Logo
> summary below, not a folder-wide index.

## Brand Posture

Dreamfeed should feel like mission-critical operating software for a
Doer-Executive: dense, inspectable, source-backed, and calm under load.

Use cues from control-room systems, SCADA/HMI surfaces, aerospace telemetry,
CAD, Bloomberg-density workflows, IDEs, and elite developer infrastructure.
Translate those cues into operational clarity, not decorative simulation.

Dreamfeed is not consumer AI. It should not look magical, playful, animated for
atmosphere, or optimized for a marketing hero.

## Visual Tokens

Use these tokens for Dreamfeed dark-canvas surfaces unless a later Dreamfeed
token file supersedes them.

```css
:root {
  --df-bg-canvas: #202426;   /* Deep Canvas */
  --df-text-1: #D8D5CC;      /* Primary Text, 10.66:1 on Deep Canvas */
  --df-text-2: #B8BDB8;      /* Secondary Text, 8.21:1 on Deep Canvas */
  --df-text-muted: #AEB4AF;  /* Muted Text, 7.41:1 on Deep Canvas */

  --df-line: #3B4142;
  --df-panel: #272C2E;
  --df-panel-raised: #303638;

  --df-green: #6FBF8A;
  --df-cyan: #7ECFD1;
  --df-amber: #D6A65A;
  --df-red: #E06B64;
}
```

The text tokens are intentionally lighter than the previous secondary and muted
values so both clear the 7:1 contrast floor against Deep Canvas.

### Layout Region Token Mapping

The five persistent Command Center regions use the panel tokens consistently:

| Persistent region | Required surface token | Application rule |
| --- | --- | --- |
| Left sidebar | `--df-panel` | Stable navigation and pinned-context plane. |
| Top command bar | `--df-panel-raised` | Elevated command, mode, and filter plane. |
| Main canvas | `--df-bg-canvas` with `--df-panel` for contained work areas | The canvas remains the lowest visual plane; do not turn the whole work surface into a raised card. |
| Right inspector | `--df-panel` with `--df-panel-raised` for active action wells | Object detail remains visually distinct without competing with the main canvas. |
| Bottom panel | `--df-panel-raised` with `--df-panel` for grouped trace rows | Logs, validation, and trace controls remain available as an elevated operational plane. |

Do not swap these token roles for decoration. A raised surface signals an
active command, inspection, or trace context, not a generic card treatment.

## Typography

IBM Plex Mono is the canonical monospace typeface for Dreamfeed command, path,
ID, timestamp, schema, and evidence surfaces.

Use a Structural Sans (grotesque or neo-grotesque) for layout labels, region
headers, navigation, and other spatial orientation cues. Use monospace for
aligned operational data and source-backed content, not for every label.

Rules:

- Use monospace type for source-backed data, not as decoration.
- Keep operational labels compact and scannable.
- Thin font weights are prohibited. Do not use weights below 400 for persistent
  UI text, code, status, or data because thin strokes degrade rapid foveal
  parsing.
- Preserve distinct character shapes for `0`/`O`, `1`/`I`/`l`, `5`/`S`,
  `2`/`Z`, and `8`/`B`.
- Require a distinct horizontal bottom serif/foot on lowercase `l`; do not
  require a curved tail.
- Zeroes must render with a clean internal diagonal slash. Do not use central
  dots or unmarked circles; use an approved glyph configuration or fallback
  where the canonical font build cannot provide the required zero.
- Set multi-line operational text, code, logs, tables, and stacked labels to a
  line height from 140% to 150% of character body size. Tighter line heights
  are not allowed on persistent reading surfaces.
- Avoid viewport-scaled typography and negative letter spacing.

## Logo

**Mark: Verified Node.** A filled core node inside an Operational Amber
confirming ring with a directional gap and an asymmetric terminal cut —
reads as resolved/trust with implied forward direction, without literal
motion or an arrowhead. **Exact geometry (gap angle, dimensions, color
values, terminal-cut construction) and full render history live in
`logo-concept-specs.md` — that file is the single source of truth for the
mark's construction; do not restate or re-derive the numeric values here.**

**Combination mark.** Symbol + wordmark (IBM Plex Mono), usable together or
separately. Rendered asset set lives at `../design-system/assets/`.
For current per-asset status (what's rendered, what's still outstanding —
print-ready files and raster exports), see `logo-concept-specs.md` §
Required Use Cases.

**Trademark/resemblance clearance has not been run.** Treat the mark as
final for internal/MVP use; do not treat it as cleared for unrestricted
public/commercial use until that legal step completes.

**Do not modify the mark's construction** without updating
`logo-concept-specs.md` first — it is the one piece of Dreamfeed's identity
not expressible purely as a CSS token, so changes here need their own
record the way token changes do.

## Functional Green

Functional Green is a state color, not a brand atmosphere. It may persist only
when the underlying state persists in the operational record.

Persistent green is allowed for:

- Historical success logs, including completed Execution Trace Map events,
  passed checks, accepted deploys, and verified audit records.
- Active LIVE environment states, including LIVE Rollback badges and other
  production/live environment indicators where continuous awareness is required.

Transient green is required for:

- Momentary UI confirmations such as toggles, copied commands, saved fields,
  applied filters, or one-off action success.

Do not use green for decoration, ambient reassurance, generic "good" surfaces,
or as the only indicator of state. Pair it with state text, timestamp, and
source/provenance where the state affects operational judgment.

## Operational Alert Colors

Functional color is reserved for state that needs operator attention. Keep
saturated alert color to the smallest practical area and never use it as a
background atmosphere.

### Operational Amber

Operational Amber (`--df-amber`, approximately 590-610 nm) is for active
process execution, warnings, queue delay, or latency requiring standard human
observation. It signals "observe and assess," not success, failure, or a
generic active-selection state.

### Systemic Off-Nominal Red

Systemic Off-Nominal Red (`--df-red`) is for complete module halts, syntax or
validation failures, and architectural blockages requiring immediate
intervention. It is not a general emphasis color. Pair it with the affected
object, diagnostic reason, timestamp, and available corrective action.

## Accessibility

Dreamfeed is dense by design, but density cannot reduce legibility or control.

Requirements:

- Text on Deep Canvas must meet the 7:1 floor when used for persistent reading.
- Color must never be the only state indicator.
- Every live, stale, blocked, complete, failed, accepted, or pending state needs
  explicit text.
- Timestamp operational state wherever freshness matters.
- Keep focus states visible for keyboard navigation.
- Respect reduced-motion preferences.
- Avoid tiny status chips that cannot carry legible text at default zoom.

## Non-Impingement

Dreamfeed preserves the operator's active workflow. Do not introduce
unsolicited pop-ups, modal interruptions, coach marks, forced tours, or forced
workflow guidance. Background events must remain in the appropriate persistent
region until the operator elects to inspect them.

The only exception is an explicitly blocking safety or destructive-action
decision. That interruption must state the affected object, reason, and
available action without conversational framing or promotional guidance.

## Motion, Latency, and Flash Coding

### Zero-Lag Transitions

For primary commands, toggles, filters, and state changes, render an immediate
local acknowledgement in under 100 ms. This is feedback latency, not a promise
that remote execution has completed. Do not use soft, slow, springy, or
atmospheric animations; use crisp state changes, explicit progress, and
observable traces instead.

### Flash Coding Restrictions

Flashing or pulsing is allowed only for mission-critical, un-bypassable events:

- Critical errors requiring immediate intervention may flash at 3-5 Hz.
- Latency or queue-delay conditions may flash at no more than 2 Hz.
- No other flash rates or decorative pulsing are allowed.

Alert Interlock is required: flashing stops immediately when the operator's
cursor enters, or keyboard focus moves into, the affected block, diagnostic
card, or code region. The persistent text state and trace remain available
after the motion stops. Respect reduced-motion preferences by showing the same
state without flashing.

### Flash-Safety Acceptance

Every flashing alert must also render a simultaneous non-flashing equivalent
that names the severity, affected object, diagnostic condition, timestamp, and
next available action. The non-flashing state is required even when
reduced-motion is not enabled; animation must not carry the alert alone.

Keep the flashing or saturated portion of the alert within 5% of the foveal
display area. Test the alert in its static, reduced-motion, focus-entered, and
normal-motion states before release.

## Voice & Tone

Dreamfeed microcopy uses the Linguistic Taxonomy: an industrial, diagnostic
register centered on systems stewardship, topology, deterministic runtime,
high-stewardship architecture, contextual integrity, surgical overrides, and
visual ledgers. Use these terms only when the underlying mechanism exists.

Every operational message must name the state, affected object or module,
source or cause where available, timestamp or freshness when relevant, and the
next available action. Error messages must identify the root cause and affected
scope before proposing a precise correction.

Do not use conversational apologies or anthropomorphic filler such as
"Oops!", "Sorry", "Something went wrong" without a diagnosis, "magic", or
"AI-powered". Dreamfeed reports conditions; it does not perform emotional
reassurance or pretend an opaque system is understandable.

## Forbidden Patterns

Do not use:

- Purple gradients, glassmorphism, sparkles, magic-wand metaphors, or "AI magic"
  language.
- Decorative glow, bokeh, aurora, orbital node backgrounds, or abstract
  intelligence marks.
- Fake dashboards, fake counters, or charts without source/provenance.
- Repeated rounded cards with identical metadata and no operational hierarchy.
- Consumer-chatbot composition where the user is meant to admire the assistant
  instead of inspect the work.
- Generic SaaS copy such as seamless, unlock, empower, best-in-class,
  next-generation, or enterprise-grade.

When a visual element is not tied to a state, command, object, file, source,
timestamp, or decision, remove it.
