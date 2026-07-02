A provenance / inspector detail row: sans label on the left, monospace source-backed value on the right. Use for object metadata in the right inspector.

```jsx
<KeyValue label="Type" value="Strategic initiative" mono={false} />
<KeyValue label="Source" value="docs/strategy/ROADMAP.md" />
<KeyValue label="Last observed" value="2026-06-21 14:02Z" accent="amber" />
```

`accent`: tint the value `green | amber | red | cyan` for a state-bearing field. Value may be passed as `value` or as children.
