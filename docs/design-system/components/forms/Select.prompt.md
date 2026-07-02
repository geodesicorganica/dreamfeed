Compact native dropdown for lens pickers, density, and sort/filter keys.

```jsx
<Select label="Lens" value={lens} onChange={e => set(e.target.value)}
  options={['Dashboard','Topology','IDE','Table','Document','Board']} />
<Select value={density} onChange={...} options={[{value:'compact',label:'Compact'},{value:'cozy',label:'Cozy'}]} />
```

Options accept strings or `{value,label}`. Sizes `sm | md | lg`.
