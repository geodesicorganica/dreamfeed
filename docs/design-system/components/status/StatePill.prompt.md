The canonical Dreamfeed operational state indicator — a colored dot plus an explicit text label, optionally a freshness timestamp. Use anywhere a live/active/halted/failed/idle state must be visible. Color is never the only signal — the text label is always rendered.

```jsx
<StatePill state="live" timestamp="14:02:11Z" />
<StatePill state="running" timestamp="step 4/7" />
<StatePill state="buildok" filled />
<StatePill state="halted" />
<StatePill state="queued" timestamp="+3 ahead" />
<StatePill state="selected" />
<StatePill state="archived" timestamp="2026-06-21" />
```

Canonical states (v1.1 §10):
- **Green** (verified / passed / live record): `live` `verified` `passed` `accepted` `buildok`
- **Amber** (active / observe): `active` `running` `queued` `warning`
- **Red** (halt / failure): `halted` `blocked` `failed`
- **Cyan** (selection / info): `selected` `info` `pending`
- **Neutral** (nominal / silent): `idle` `locked` `archived` `stale`

Green persistence rule: transient actions (saved, copied, applied) must clear; only historical records and active LIVE states may hold green persistently.
