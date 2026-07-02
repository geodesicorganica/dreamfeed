The View Registry lens switcher — also a general segmented/tab control. The active lens shows an underline tick and heavier weight.

```jsx
<Tabs value={lens} onChange={setLens} tabs={[
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'topology', label: 'Topology', count: 12 },
  { value: 'ide', label: 'IDE' },
  { value: 'table', label: 'Table' },
]} />
```

Tabs accept strings or `{value,label,icon,count}`. Use to switch lenses over the same object model.
