Binary mode toggle; the state is shown by knob position (and optional label), not by color alone.

```jsx
<Switch checked={live} onChange={setLive} label="Live telemetry" />
<Switch checked={reduced} onChange={setReduced} />
```

Use for shell modes (density, panel visibility, telemetry on/off). Crisp <100ms transition.
