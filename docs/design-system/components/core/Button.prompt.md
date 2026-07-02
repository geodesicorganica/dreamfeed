Neutral industrial command button; use for any click action in Dreamfeed chrome — color stays neutral because color is reserved for state.

```jsx
<Button variant="primary" size="md">Run audit</Button>
<Button variant="secondary" iconLeft={<i data-lucide="git-branch"></i>}>Branch</Button>
<Button variant="ghost" size="sm">Dismiss</Button>
<Button variant="danger">Halt module</Button>
```

Variants: `primary` (neutral raised fill), `secondary` (outline, default), `ghost` (text-only), `danger` (red outline, destructive only). Sizes `sm | md | lg`. Never use amber/green fills for emphasis — those read as state.
