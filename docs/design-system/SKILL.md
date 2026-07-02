---
name: dreamfeed-design
description: Use this skill to generate well-branded interfaces and assets for Dreamfeed, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files.

Dreamfeed is an industrial operating cockpit (the "Command Center") for a single
high-leverage operator. The aesthetic is SCADA/aerospace/CAD/Bloomberg-Terminal:
a deep-grey dark canvas, flat depth planes separated by 1px lines, IBM Plex Mono +
IBM Plex Sans typography, and color used **only** as a functional state signal
(green = verified/live, amber = observe/active, red = halt/failure, cyan = info).
No gradients, glassmorphism, glow, sparkles, emoji, or "AI magic". Color is never
the only state indicator — every state carries explicit text.

Where to look:
- `readme.md` — full brand context, CONTENT FUNDAMENTALS, VISUAL FOUNDATIONS, ICONOGRAPHY, and a file manifest.
- `styles.css` + `tokens/` — the design tokens (link `styles.css`; everything is a CSS custom property).
- `assets/` — the Verified Node logo (mark, light variant, lockup, favicon).
- `components/` — reusable React primitives (Button, Panel, StatePill, TraceRow, KeyValue, TextField, Select, Switch, Tabs, Badge, IconButton). Each has a `.prompt.md` with usage.
- `guidelines/` — foundation specimen cards (colors, type, spacing, brand).
- `ui_kits/command-center/` — an interactive recreation of the cockpit (five regions + lens registry) to copy patterns from.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy
assets out and create static HTML files for the user to view, linking `styles.css`
for the tokens. If working on production code, copy assets and read the rules here
to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want
to build or design, ask some questions, and act as an expert designer who outputs
HTML artifacts _or_ production code, depending on the need.
