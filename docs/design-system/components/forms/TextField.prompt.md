Single-line input seated in a sunken well; use `mono` for command / path / ID / schema entry.

```jsx
<TextField label="Repo path" mono prefix="/" value={v} onChange={e => set(e.target.value)} />
<TextField label="Initiative" value={name} onChange={...} />
<TextField label="Port" mono value="3000" error="Port in use" />
```

Always provide a `label`. `error` text turns the border red and prints the message (color is never the only signal). Sizes `sm | md | lg`.
