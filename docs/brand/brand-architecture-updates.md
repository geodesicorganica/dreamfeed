---
brand: Dreamfeed
document: Brand Architecture Contradiction Updates
date: 2026-06-21
status: applied
scope: Dreamfeed brand guidelines and Sovereign Architecture Research
---

# Dreamfeed Brand Architecture Updates

These sections record the corrections applied to the Dreamfeed brand documents.
This file is scoped to Dreamfeed only and does not update the parent Stakeport
brand system.

## 1. Brand Guidelines: CSS Custom Properties

Use the following Dreamfeed text-token block, or update only `--df-text-2` and
`--df-text-muted` if the surrounding CSS already exists.

```css
:root {
  --df-bg-canvas: #202426;   /* Deep Canvas */
  --df-text-1: #D8D5CC;      /* Primary Text, 10.66:1 on Deep Canvas */
  --df-text-2: #B8BDB8;      /* Secondary Text, 8.21:1 on Deep Canvas */
  --df-text-muted: #AEB4AF;  /* Muted Text, 7.41:1 on Deep Canvas */
}
```

Rationale: the previous Secondary Text value `#9EA6A8` measured 6.32:1
against `#202426`, and the previous Muted Text value `#747C80` measured 3.68:1.
Both failed the 7:1 floor required by the Architecture Research document. The
updated pair clears 7:1 while staying subordinate to Primary Text.

## 2. Brand Guidelines: Functional Green

Applied Functional Green rule:

### Functional Green

Functional Green is a state color, not a brand atmosphere. It may persist only
when the underlying state persists in the operational record.

Persistent green is allowed for:

- Historical success logs, including completed Execution Trace Map events,
  passed checks, accepted deploys, and verified audit records. In these contexts
  green means the event completed successfully and remains part of the record.
- Active LIVE environment states, including LIVE Rollback badges and other
  production/live environment indicators where continuous awareness is required.

Transient green is required for:

- Momentary UI confirmations such as toggles, copied commands, saved fields,
  applied filters, or one-off action success. Acknowledge the success, then
  clear the green state or return the control to neutral.

Do not use green for decoration, ambient reassurance, generic "good" surfaces,
or as the only indicator of state. Pair it with explicit state text, timestamp,
and source/provenance where the state affects operational judgment.

## 3. Architecture Research: Homoglyph And Character Differentiation

Applied homoglyph section:

### Homoglyph And Character Differentiation

Dreamfeed uses IBM Plex Mono as the canonical monospace typeface for command,
path, ID, timestamp, schema, and evidence surfaces. The typeface must support
rapid disambiguation of high-risk operational characters under dense scanning
conditions.

Required character differentiation:

- Numeral `0` must remain distinguishable from uppercase `O`.
- Numeral `1`, uppercase `I`, and lowercase `l` must remain distinguishable in
  IDs, paths, validator names, command output, and status rows.
- Lowercase `l` must have a distinct horizontal bottom serif/foot. Do not
  require a curved tail; IBM Plex Mono does not use that construction.
- Similar pairs such as `5`/`S`, `2`/`Z`, `8`/`B`, punctuation marks, and path
  separators must remain legible at the smallest supported UI size.

Validation strings for typography review:

```text
Ill1lI
0OQD
5S2Z8B
repo/src/workgraph.js
DF-LIVE-ROLLBACK-001
```

The ergonomic requirement is character disambiguation in operational contexts,
not allegiance to a specific decorative glyph shape. IBM Plex Mono satisfies
the intended requirement through the lowercase `l` foot/serif and its broader
monospace character differentiation.

## 4. Architecture Research: OCR And Formatting Cleanup

These cleanup replacements were applied in the Dreamfeed research documents.

| Raw artifact | Replacement |
|---|---|
| `\approx 590\text{ nm}` | `approximately 590 nm` |
| `\frac{\Delta \Theta}{\Delta E \cdot \Phi_s}` | `(Delta Theta) / (Delta E * Phi_s)` |
| `pre[span_68](start_span)...cision` | `precision` |
| `\g[span_79]...e 100)` | `>= 100` |

General cleanup rule:

Do not leave raw TeX commands, scraped span markers, bracketed OCR artifacts,
or broken inline tokens in the final research text. If the final document
pipeline supports rendered equations, render the formula. If it does not, use
plain text notation that preserves the mathematical relationship without TeX
syntax.
