One row of an Execution Trace Map or log ledger; names the event, a mono detail/path, and a timestamp. Use to build the bottom-panel trace surface.

```jsx
<TraceRow status="ok" label="Audit passed" detail="repo/src/workgraph.js" timestamp="14:02:09Z" />
<TraceRow status="active" label="Deploy running" detail="step 4/7" timestamp="14:02:11Z" selected />
<TraceRow status="error" label="Validation failed" detail="DF-LIVE-ROLLBACK-001" timestamp="14:01:55Z" onClick={fn} />
```

`status`: `ok active warn error info muted`. Pass `onClick` to make rows selectable; `selected` shows the left tick + raised background.
