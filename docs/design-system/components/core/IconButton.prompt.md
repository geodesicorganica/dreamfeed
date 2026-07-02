Square icon-only control for command bars and region chrome; pass `active` to show a held mode.

```jsx
<IconButton label="Topology lens" active><i data-lucide="share-2"></i></IconButton>
<IconButton label="Filter"><i data-lucide="filter"></i></IconButton>
```

Always provide `label` (used for aria + tooltip). Sizes `sm | md | lg`.
