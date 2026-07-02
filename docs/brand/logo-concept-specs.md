---
brand: Dreamfeed
document: Logo Construction Spec — Verified Node (Directional Revision)
date: 2026-06-21
status: Rendered and finalized (2026-06-22) — see design-system/assets/
scope: Dreamfeed-only combination-mark spec for MVP-launch identity lock
---

# Dreamfeed Logo Construction Spec

> **Selected concept: Verified Node — Directional Revision.** Chosen from a
> field of 10 candidate directions, narrowed to 5 via psychology-based design
> research, then revised once more per founder decision to strengthen the
> mark's own motivation signal. **Rendered 2026-06-22** via Claude Design as
> a full asset set in `docs/dreamfeed/design-system/assets/`
> (`logo-mark.svg`, `logo-mark-light.svg`, `logo-lockup.svg`,
> `logo-lockup-light.svg`, `logo-stacked.svg`, `logo-stacked-light.svg`,
> `logo-wordmark.svg`, `logo-social.svg`, `favicon.svg`, `og-card.svg`). The
> same folder also includes `pattern-grid.svg`, a supporting CAD-grid
> background tile (not a logo asset — scoped to topology-canvas surfaces
> only; see its own embedded `<desc>` for usage). The rendered mark
> fully implements the spec as written, including the asymmetric directional
> terminal cut — built as a closed, filled shape (two arcs joined by short
> connecting lines) rather than a simple stroked arc, which is what makes the
> per-end asymmetry possible in SVG. An earlier render pass used a simpler
> stroked-arc construction without the terminal cut; that version has been
> superseded and removed — see **Rendered vs. Spec** below for the full history.
>
> **Locked inputs this spec satisfies** (see `brand-brief.md` and the
> interview log for full derivation):
> - Mark type: combination mark (symbol + wordmark, usable together and apart)
> - Required emotional signal: confidence, motivation, trust — calm-first,
>   motivation expressed through implied direction/progression, not energy/motion
> - Primary job: external first-impression credibility (not just internal recognition)
> - Token/typography system: change only on demonstrated need — default is
>   inherit `brand-guidelines.md` as-is
> - Asset scope: standard SaaS digital set + print-ready files
> - Visual register: CAD/SCADA/aerospace-telemetry lineage; no gradients,
>   glassmorphism, sparkles, glow, or decorative motion

## Concept Summary

One node with a partial confirming ring around it. The ring's gap is widened
and angled to read as an explicit forward/upward vector — rather than a
neutral "in-progress" notch — keeping the verified-node trust/simplicity core
while giving the symbol itself a clear motivation signal, rather than
deferring that entirely to wordmark, tagline, or voice.

This was selected over four other candidates (an ascending node-path, an
anchored grid-mark, a bracketed monogram, and a node-graph/topology mark) for
its combination of high trust/stability, high simplicity and recall, and
(after this revision) adequate motivation signal carried by the symbol itself.

## Construction

- **Grid:** 12×12 unit base grid (deliberately small/simple, reflecting the
  mark's minimalism).
- **Core form:** one filled circle, diameter 6 units, centered at (6,6),
  fill `--df-text-1`.
- **Ring:** an open ring of outer diameter 10 units, stroke 1 unit,
  surrounding the core node with a consistent 1-unit gap. The gap is **100°
  wide**, centered on the **1:30 clock position** (the diagonal exactly
  between 1 and 2 o'clock, i.e. 45° from vertical).
- **Ring terminals:** the leading (upper-right) end of the ring is cut
  perpendicular to its own tangent — built as a closed, filled shape (an
  outer arc, a short straight segment forming the perpendicular cut, then an
  inner arc back to the start) rather than a simple open stroke. The
  trailing (lower-left) end uses a plain flat edge with no special
  treatment. This asymmetry is what reads as "pointing forward" without
  drawing a literal arrowhead, and is only achievable in SVG via a filled
  closed-path construction — a single stroked `<path>` with one
  `stroke-linecap` value cannot express two different end treatments on its
  two ends.
- **Ring color:** `--df-amber`. This intentionally echoes the in-product
  Operational Amber "observe" semantic from `brand-guidelines.md` as a
  structural-identity choice, not a live-state claim — this is a static mark,
  and should remain visually distinct in context from any actual in-product
  Operational Amber usage.

## Lockup

- Symbol left of wordmark, gap = 0.75× node diameter (tightest gap of the
  candidates considered, since this is the smallest/simplest mark).
- Wordmark: **IBM Plex Mono recommended** — reinforces that this is the same
  in-product, system-native register the symbol echoes, not a separate
  marketing veneer.
- Required lockup variants: primary horizontal (dark canvas), primary
  horizontal (light canvas), stacked (symbol above wordmark), wordmark-alone,
  icon-alone.

## Light-Canvas Adaptation

Core node fill inverts to dark (`logo-mark-light.svg` uses `--df-panel`
`#272C2E`); amber ring unchanged — it already passes contrast on both
canvases per the existing token contrast work in `brand-guidelines.md`.

## Minimum Size / Favicon Fallback

`favicon.svg` uses a **simplified variant**: a plain stroked arc (standard
butt cap, no terminal cut) at a tighter radius (7.5 vs. 9), since the fine
terminal-cut detail does not survive faithfully below ~24px. This matches
the original spec's intent — the gap's position/angle (the core motivation
device) is preserved at favicon scale; only the secondary terminal-cut
refinement is dropped at that size specifically, exactly as the original
spec anticipated.

## New Token Need

None. Fully expressible in the existing `brand-guidelines.md` palette.

## Risks / Resemblance Check

Single-node-with-ring marks resemble "loading spinner" or "status badge" UI
conventions broadly (not any one specific competitor). The widened, angled
gap reduces this risk somewhat versus a generic centered/symmetric ring (a
generic loading spinner does not typically open at a fixed, asymmetric
position) — but this is a design judgment, not a cleared legal opinion.
Test at multiple sizes before finalizing. Formal trademark/resemblance
clearance is a separate legal step, not covered by this design check.

## Shared System

### Color (inherited from `brand-guidelines.md` — unchanged)

```css
--df-bg-canvas: #202426;   /* Deep Canvas */
--df-text-1: #D8D5CC;      /* Primary Text, 10.66:1 on Deep Canvas */
--df-line: #3B4142;
--df-panel: #272C2E;
--df-panel-raised: #303638;
--df-green: #6FBF8A;
--df-cyan: #7ECFD1;
--df-amber: #D6A65A;
--df-red: #E06B64;
```

No new hex values are introduced. This mark ships entirely within the
existing palette.

### Print Conversion (new — not previously specified; added per asset-scope decision)

| Token | Screen (sRGB hex) | CMYK (approx., coated stock) | Pantone (closest) |
|---|---|---|---|
| Deep Canvas | #202426 | C:62 M:50 Y:46 K:62 | Pantone Black 6 C (closest cool-neutral) |
| Primary Text | #D8D5CC | C:8 M:8 Y:14 K:0 | Pantone 7527 C |
| Operational Amber | #D6A65A | C:5 M:35 Y:75 K:0 | Pantone 1395 C |
| Functional Green | #6FBF8A | C:50 M:0 Y:45 K:0 | Pantone 7480 C |

> Treat these as starting points for a professional print-proofing pass, not
> final production values — coated/uncoated stock and printer calibration
> will shift actual output. Confirm against a physical proof before
> high-volume print runs.

### Typography (inherited from `brand-guidelines.md` — unchanged)

- Wordmark: IBM Plex Mono (canonical monospace), per the lockup recommendation above.
- Minimum weight 400. No thin weights. No negative letter-spacing.
- Lowercase `l` requires a horizontal bottom serif/foot (already satisfied by
  the canonical font — no custom alteration needed).

### Required Use Cases

| Use case | Format | Rendered file | Status |
|---|---|---|---|
| Favicon | .svg (16×16, 32×32, 48×48 tested) | `favicon.svg` | ✅ Rendered |
| App icon | .svg, 96×96 source | `logo-mark.svg` (use as app-icon source) | ✅ Rendered |
| Primary lockup (dark canvas) | .svg | `logo-lockup.svg` | ✅ Rendered |
| Primary lockup (light canvas) | .svg | `logo-lockup-light.svg` | ✅ Rendered |
| Stacked lockup (dark) | .svg | `logo-stacked.svg` | ✅ Rendered |
| Stacked lockup (light) | .svg | `logo-stacked-light.svg` | ✅ Rendered |
| Wordmark-alone | .svg | `logo-wordmark.svg` | ✅ Rendered |
| Icon-alone (dark) | .svg | `logo-mark.svg` | ✅ Rendered |
| Icon-alone (light) | .svg | `logo-mark-light.svg` | ✅ Rendered |
| Social avatar | .svg, 1:1 square | `logo-social.svg` | ✅ Rendered |
| Link/OG preview card | .svg, 1200×630 | `og-card.svg` | ✅ Rendered — full lockup + "Command Center" subtitle on dark canvas with grid texture |
| Deck/marketing header | .svg | (use `logo-lockup.svg`, scale up) | ✅ Covered by lockup |
| Business card / letterhead | print-ready .pdf (CMYK) | — | 🔲 Not yet produced — print conversion table above gives starting CMYK/Pantone values for a designer to build print-ready files from the SVG source |
| Raster exports (.png/.ico) | various sizes | — | 🔲 Not yet produced — SVGs above are the source of truth; raster exports can be generated from them as needed per platform requirement (e.g. .ico for legacy favicon support) |

All SVG assets live in
`docs/dreamfeed/design-system/assets/`. The folder also includes a
full supporting design system (components, design tokens as CSS, guideline
pages, a UI-kit recreation of the cockpit) beyond the logo itself — see that
folder's `readme.md` for its complete index.

## Rendered vs. Spec — Summary of Changes

> **Scale note:** the spec's construction grid is 12×12 units; the rendered SVGs
> use a 24-unit viewBox. The render is a uniform 2x scale-up of the spec, so
> diameters (not radii) are the correct unit to compare — a spec diameter of
> *N* units should appear in the render as a diameter of *2N* units (radius *N*).

| Spec requirement (12-unit grid) | Rendered result (24-unit viewBox) | Disposition |
|---|---|---|
| Core node, 6-unit diameter, `--df-text-1` | Matches — circle `r=6` = 12-unit diameter = 2× the spec's 6-unit diameter, consistent with the 2x scale-up; fill `#D8D5CC` | ✅ As specified |
| Ring outer diameter 10 units | Matches — outer arc radius 10 = 20-unit diameter = 2× the spec's 10-unit diameter, consistent with the 2x scale-up | ✅ As specified |
| 100° gap centered on 1:30 axis | Matches (arc sweep confirms a ~100° gap opening toward upper-right) | ✅ As specified |
| Ring color `--df-amber` | Matches (`#D6A65A`) | ✅ As specified |
| Asymmetric perpendicular cut on leading end only | Matches — built as a closed, filled shape (outer arc → short perpendicular segment → inner arc) rather than a stroked open path | ✅ As specified (after a construction-technique correction — see history below) |

### Render history

Two render passes produced this mark, in this order:

1. **First pass (2026-06-22, morning):** used a simple stroked open `<path>`
   (one arc, one `stroke-linecap: butt` applied uniformly to both ends).
   This could not express the spec's asymmetric terminal cut — SVG's
   `stroke-linecap` is a single property applying to an entire path, not
   settable per-end. The rendered mark had a plain, symmetric gap with no
   directional terminal treatment. This version was initially accepted as a
   "good enough" simplification, on the reasoning that the gap's
   position/angle alone carries the motivation signal.
2. **Second pass (2026-06-22, evening):** re-rendered using a closed, filled
   shape instead of a stroked path — an outer arc, a short straight segment
   cut perpendicular to the tangent at the leading end, and an inner arc
   back to the starting point, all filled rather than stroked. This
   technique change makes the asymmetric terminal cut achievable, and the
   second pass implements it correctly. **This is the version now in
   `docs/dreamfeed/design-system/assets/` and is canonical.** The
   first pass's folder and zip have been deleted — fully superseded, no
   unique content lost (verified via file-by-file diff before deletion).

The lesson for future asset work: when a construction spec calls for an
asymmetric treatment on an open curve, request a filled closed-shape
construction up front rather than a stroked path — the stroked approach
cannot express it and will silently simplify instead of erroring.

## Next Steps

1. ~~Hand this spec to a designer or image-generation tool for rendering~~ —
   **done 2026-06-22**, via Claude Design. Full asset set at
   `docs/dreamfeed/design-system/assets/`.
2. Run a trademark/resemblance search on "Dreamfeed" as a name and on the
   rendered mark (loading-spinner/status-badge adjacency, flagged above) —
   **still outstanding**, this is a legal step this design process does not cover.
3. Produce print-ready files (business card/letterhead) and any needed
   raster exports (.png/.ico) from the SVG sources — **still outstanding**.
4. Fold the finalized logo section into `brand-guidelines.md` as the
   canonical Logo entry, pointing to the Design System folder as the asset
   source of truth — see brand-guidelines.md for current status.

## Sources (design-psychology research informing concept selection)

- [Shape Psychology in Logo Design — Ramotion Agency](https://www.ramotion.com/blog/shapes-in-logo-design/)
- [Logo shape psychology: How shapes influence brand identity — Adobe](https://www.adobe.com/express/learn/blog/guide-to-logo-shapes)
- [The visual language of brand logos: logo simplicity and perceptions of brand warmth and competence — ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0148296325004035)
- [The Hidden Psychology of Shapes in Logo Design](https://www.creativelykira.com/post/psychology-of-shapes)
- [The Psychology of Shapes in Logo designs — Kreafolk](https://kreafolk.com/blogs/articles/the-psychology-of-shapes-logo-designs)
- [Top 7 SaaS Design Trends to Elevate B2B Products in 2025 — Lollypop](https://lollypop.design/blog/2025/april/saas-design-trends/)
