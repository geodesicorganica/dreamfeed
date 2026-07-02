A depth-plane surface for the five persistent Command Center regions; choose `surface` to place it on the canvas/panel/raised hierarchy.

```jsx
<Panel surface="panel" title="Inspector" meta="initiative-014" actions={<IconButton label="Pin"><i data-lucide="pin"></i></IconButton>}>
  …object detail…
</Panel>
```

`surface`: `canvas | panel | raised | sunken`. A `raised` panel means an active command/inspection/trace context, not a generic card. Header overline label via `title`; mono `meta` for IDs/timestamps.
