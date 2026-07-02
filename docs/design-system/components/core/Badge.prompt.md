Small count / label chip; tint with a functional state `tone` but always keep legible text (never color-only).

```jsx
<Badge>Draft</Badge>
<Badge tone="warn">3 queued</Badge>
<Badge mono tone="ok">v1.4.2</Badge>
```

`tone`: `neutral | info | ok | warn | error`. Use `mono` for IDs, counts, versions.
