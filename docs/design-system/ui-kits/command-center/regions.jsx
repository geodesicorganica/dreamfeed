/* Dreamfeed Command Center — the five persistent regions.
   Composes design-system primitives from window.DreamfeedDesignSystem_7401df. */
(function () {
  const DS = window.DreamfeedDesignSystem_7401df;
  const { Panel, IconButton, Button, StatePill, KeyValue, Badge, TextField, Switch, Tabs, TraceRow } = DS;

  function Icon({ name, size = 16 }) {
    return <i data-lucide={name} style={{ display: 'inline-flex', width: size, height: size }}></i>;
  }

  /* ---------------- Left sidebar (--df-panel) ---------------- */
  const NAV = [
    { id: 'overview', icon: 'layout-dashboard', label: 'Overview' },
    { id: 'initiatives', icon: 'target', label: 'Initiatives', count: 2 },
    { id: 'work', icon: 'list-checks', label: 'Work items', count: 4 },
    { id: 'agents', icon: 'bot', label: 'Agents', count: 2 },
    { id: 'sources', icon: 'folder-git-2', label: 'Source files' },
  ];

  function Sidebar({ active, onNav, pinned, onSelect, selectedId }) {
    return (
      <aside style={{ width: 'var(--region-sidebar-w)', flex: '0 0 auto', background: 'var(--surface-panel)', borderRight: 'var(--border-default)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ height: 'var(--region-commandbar-h)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderBottom: 'var(--border-default)' }}>
          <img src="../../assets/logo-mark.svg" width="22" height="22" alt="" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--text-primary)' }}>Dreamfeed</span>
        </div>
        <nav style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ padding: '4px 8px 6px', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Work modes</div>
          {NAV.map(n => {
            const on = active === n.id;
            return (
              <button key={n.id} onClick={() => onNav(n.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, height: 30, padding: '0 8px', border: 'none', borderRadius: 'var(--radius-1)', cursor: 'pointer',
                background: on ? 'var(--df-panel-raised)' : 'transparent', color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: on ? 600 : 400, textAlign: 'left',
              }}>
                <Icon name={n.icon} size={15} />
                <span style={{ flex: 1 }}>{n.label}</span>
                {n.count != null && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{n.count}</span>}
              </button>
            );
          })}
        </nav>
        <div style={{ padding: '6px 8px', borderTop: 'var(--border-default)', marginTop: 4, flex: 1, minHeight: 0, overflow: 'auto' }}>
          <div style={{ padding: '4px 8px 6px', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Pinned context</div>
          {pinned.map(o => {
            const on = selectedId === o.id;
            return (
              <button key={o.id} onClick={() => onSelect(o.id)} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: 28, padding: '0 8px', border: 'none', borderLeft: `2px solid ${on ? 'var(--df-amber)' : 'transparent'}`, cursor: 'pointer',
                background: on ? 'var(--df-panel)' : 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'left',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', flex: '0 0 auto', background: stateColor(o.state) }}></span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: on ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{o.id}</span>
              </button>
            );
          })}
        </div>
        <div style={{ padding: '8px 14px', borderTop: 'var(--border-default)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatePill state="live" label="V1 LIVE" />
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>localhost</span>
        </div>
      </aside>
    );
  }

  /* ---------------- Top command bar (--df-panel-raised) ---------------- */
  function CommandBar({ live, onLive, density, onDensity }) {
    return (
      <header style={{ height: 'var(--region-commandbar-h)', flex: '0 0 auto', background: 'var(--surface-raised)', borderBottom: 'var(--border-default)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 360, maxWidth: '40%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, height: 28, padding: '0 10px', background: 'var(--surface-sunken)', border: 'var(--border-default)', borderRadius: 'var(--radius-1)' }}>
            <Icon name="search" size={14} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>command or object…</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', border: 'var(--border-default)', borderRadius: 2, padding: '0 4px' }}>⌘K</span>
          </div>
        </div>
        <Badge mono>main</Badge>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>parsed 14:02:09Z</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Switch checked={live} onChange={onLive} label="Live" />
          <div style={{ display: 'flex', gap: 2 }}>
            <IconButton label="Compact density" active={density === 'compact'} onClick={() => onDensity('compact')}><Icon name="rows-3" size={15} /></IconButton>
            <IconButton label="Cozy density" active={density === 'cozy'} onClick={() => onDensity('cozy')}><Icon name="rows-2" size={15} /></IconButton>
          </div>
          <IconButton label="Keyboard"><Icon name="keyboard" size={15} /></IconButton>
        </div>
      </header>
    );
  }

  /* ---------------- Right inspector (--df-panel) ---------------- */
  function Inspector({ obj, onSelect }) {
    if (!obj) {
      return (
        <aside style={inspectorShell}>
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>No object selected. Select a node, row, or trace.</div>
        </aside>
      );
    }
    const rels = (obj.rels || []).map(id => window.CC_DATA.byId[id]).filter(Boolean);
    return (
      <aside style={inspectorShell}>
        <div style={{ padding: '12px 14px', borderBottom: 'var(--border-default)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>{obj.type}</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{obj.title}</div>
          </div>
          <div style={{ marginTop: 8 }}><StatePill state={obj.state} timestamp={obj.observed} /></div>
        </div>
        <div style={{ padding: '6px 14px', flex: 1, minHeight: 0, overflow: 'auto' }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, padding: '8px 0 10px' }}>{obj.detail}</div>
          <KeyValue label="Object ID" value={obj.id} />
          <KeyValue label="Owner" value={obj.owner} />
          <KeyValue label="Source" value={obj.source} />
          <KeyValue label="Last observed" value={obj.observed} accent="amber" />
          {rels.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Relationships</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {rels.map(r => (
                  <button key={r.id} onClick={() => onSelect(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 26, padding: '0 8px', border: 'var(--border-default)', borderRadius: 'var(--radius-1)', background: 'var(--surface-sunken)', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', flex: '0 0 auto', background: stateColor(r.state) }}></span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-primary)' }}>{r.id}</span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.type}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: 12, borderTop: 'var(--border-default)', background: 'var(--surface-raised)', display: 'flex', gap: 8 }}>
          <Button variant="primary" size="md" style={{ flex: 1 }}>Inspect source</Button>
          <Button variant="secondary" size="md">Trace</Button>
        </div>
      </aside>
    );
  }
  const inspectorShell = { width: 'var(--region-inspector-w)', flex: '0 0 auto', background: 'var(--surface-panel)', borderLeft: 'var(--border-default)', display: 'flex', flexDirection: 'column', minHeight: 0 };

  /* ---------------- Bottom panel (--df-panel-raised) ---------------- */
  function BottomPanel({ traces, onSelectTrace, selectedTrace }) {
    const [tab, setTab] = React.useState('traces');
    const counts = { ok: 0, error: 0 };
    traces.forEach(t => { if (t.status === 'ok') counts.ok++; if (t.status === 'error') counts.error++; });
    return (
      <section style={{ height: 'var(--region-bottompanel-h)', flex: '0 0 auto', background: 'var(--surface-raised)', borderTop: 'var(--border-default)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', borderBottom: 'var(--border-default)' }}>
          <div style={{ flex: 1 }}>
            <Tabs value={tab} onChange={setTab} tabs={[
              { value: 'traces', label: 'Execution Trace Map', count: traces.length },
              { value: 'validation', label: 'Validation', count: counts.error },
              { value: 'logs', label: 'Command output' },
            ]} />
          </div>
          <Badge tone="info" style={{ marginRight: 8 }}>read-only · V1</Badge>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '4px 0' }}>
          {tab !== 'logs' ? (traces
            .filter(t => tab === 'traces' || t.status === 'error' || t.status === 'warn')
            .map((t, i) => (
              <TraceRow key={i} status={t.status} label={t.label} detail={t.detail} timestamp={t.ts}
                selected={selectedTrace === i} onClick={() => onSelectTrace(i)} />
            ))
          ) : (
            <pre style={{ margin: 0, padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{`$ df parse docs/strategy/ROADMAP.md
  parsed 11 governance objects · 7 edges
  topology rebuilt in 38ms
$ df audit --read-only
  4 passed · 1 failed · 1 blocked`}</pre>
          )}
        </div>
        <div style={{ padding: '6px 12px', borderTop: 'var(--border-default)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <StatePill state="passed" label={counts.ok + ' PASSED'} />
          <StatePill state="failed" label={counts.error + ' FAILED'} />
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>Surgical Overrides unlock in execution-enabled phase</span>
        </div>
      </section>
    );
  }

  function stateColor(s) {
    return ({
      live: 'var(--df-green)', verified: 'var(--df-green)', passed: 'var(--df-green)', accepted: 'var(--df-green)',
      active: 'var(--df-amber)', queued: 'var(--df-amber)', warning: 'var(--df-amber)',
      blocked: 'var(--df-red)', failed: 'var(--df-red)', pending: 'var(--df-cyan)',
    })[s] || 'var(--text-muted)';
  }

  Object.assign(window, { CCSidebar: Sidebar, CCCommandBar: CommandBar, CCInspector: Inspector, CCBottomPanel: BottomPanel, CCIcon: Icon, ccStateColor: stateColor });
})();
