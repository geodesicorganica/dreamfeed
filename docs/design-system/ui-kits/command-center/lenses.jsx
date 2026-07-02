/* Dreamfeed Command Center — View Registry lenses over the same object model. */
(function () {
  const DS = window.DreamfeedDesignSystem_7401df;
  const { Panel, StatePill, Badge, KeyValue, Button } = DS;
  const Icon = window.CCIcon;
  const stateColor = window.ccStateColor;

  /* ---------------- Dashboard lens ---------------- */
  function DashboardLens({ objects, onSelect }) {
    const blockers = objects.filter(o => o.state === 'blocked' || o.state === 'failed');
    const active = objects.filter(o => o.state === 'active');
    const live = objects.filter(o => o.state === 'live' || o.state === 'verified');
    const Stat = ({ n, label, accent }) => (
      <div style={{ flex: 1, padding: '12px 14px', background: 'var(--surface-panel)', border: 'var(--border-default)', borderRadius: 'var(--radius-2)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 600, color: accent || 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{String(n).padStart(2, '0')}</div>
        <div style={{ fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 6 }}>{label}</div>
      </div>
    );
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, height: '100%', overflow: 'auto', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <Stat n={live.length} label="Live / verified" accent="var(--df-green)" />
          <Stat n={active.length} label="Active execution" accent="var(--df-amber)" />
          <Stat n={blockers.length} label="Blocked / failed" accent="var(--df-red)" />
          <Stat n={objects.length} label="Tracked objects" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flex: 1, minHeight: 0 }}>
          <Panel surface="panel" title="Blockers" meta={blockers.length + ' requiring intervention'} padded={false}>
            <div style={{ padding: '4px 0' }}>
              {blockers.map(o => (
                <button key={o.id} onClick={() => onSelect(o.id)} style={objRow}>
                  <StatePill state={o.state} />
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-primary)', flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{o.id}</span>
                </button>
              ))}
            </div>
          </Panel>
          <Panel surface="panel" title="Active execution" meta="live telemetry" padded={false}>
            <div style={{ padding: '4px 0' }}>
              {active.map(o => (
                <button key={o.id} onClick={() => onSelect(o.id)} style={objRow}>
                  <StatePill state={o.state} timestamp={o.observed} />
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-primary)', flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{o.owner}</span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    );
  }
  const objRow = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: 32, padding: '0 12px', border: 'none', background: 'transparent', cursor: 'pointer' };

  /* ---------------- Topology / Graph lens ---------------- */
  function TopologyLens({ topology, selectedId, onSelect }) {
    const pos = Object.fromEntries(topology.nodes.map(n => [n.id, n]));
    return (
      <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden', background: 'var(--surface-canvas)', backgroundImage: 'linear-gradient(var(--df-line) 1px, transparent 1px), linear-gradient(90deg, var(--df-line) 1px, transparent 1px)', backgroundSize: '40px 40px', backgroundPosition: 'center' }}>
        <div style={{ position: 'absolute', top: 12, left: 14, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>topology · 7 nodes · 7 edges</div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {topology.edges.map(([a, b], i) => (
            <line key={i} x1={pos[a].x} y1={pos[a].y} x2={pos[b].x} y2={pos[b].y}
              stroke="var(--df-line)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {topology.nodes.map(n => {
          const on = selectedId === n.id;
          return (
            <button key={n.id} onClick={() => onSelect(n.id)} title={n.id} style={{
              position: 'absolute', left: n.x + '%', top: n.y + '%', transform: 'translate(-50%,-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
            }}>
              <span style={{
                width: on ? 18 : 14, height: on ? 18 : 14, borderRadius: '50%', background: stateColor(n.state),
                boxShadow: on ? '0 0 0 4px var(--df-bg-canvas), 0 0 0 5px var(--df-amber)' : '0 0 0 3px var(--df-bg-canvas)',
                transition: 'all 120ms var(--ease-crisp)',
              }}></span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: on ? 'var(--text-primary)' : 'var(--text-secondary)', background: 'var(--surface-canvas)', padding: '0 3px' }}>{n.id}</span>
            </button>
          );
        })}
      </div>
    );
  }

  /* ---------------- IDE lens ---------------- */
  const FILES = [
    { name: 'tools/command-center/', dir: true },
    { name: '  src/regions/inspector.tsx', state: 'verified' },
    { name: '  src/regions/bottom.tsx', state: 'blocked' },
    { name: '  src/lenses/topology.tsx', state: 'active' },
    { name: '  tokens/typography.css', state: 'verified' },
    { name: '  schema/trace.json', state: 'failed' },
  ];
  function IdeLens({ onSelect }) {
    return (
      <div style={{ display: 'flex', height: '100%', background: 'var(--surface-canvas)' }}>
        <div style={{ width: 230, flex: '0 0 auto', borderRight: 'var(--border-default)', padding: '8px 0', overflow: 'auto' }}>
          {FILES.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 24, padding: '0 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: f.dir ? 'var(--text-muted)' : 'var(--text-secondary)', whiteSpace: 'pre', cursor: f.dir ? 'default' : 'pointer' }}>
              {!f.dir && <span style={{ width: 6, height: 6, borderRadius: '50%', background: stateColor(f.state), flex: '0 0 auto' }}></span>}
              {f.dir && <Icon name="folder-git-2" size={13} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name.trim()}</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 30, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderBottom: 'var(--border-default)', background: 'var(--surface-panel)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>schema/trace.json</span>
            <StatePill state="failed" />
          </div>
          <pre style={{ margin: 0, padding: 14, flex: 1, overflow: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-secondary)', fontFeatureSettings: "'zero' 1, 'ss01' 1" }}>{`{
  "trace": "DF-LIVE-ROLLBACK-001",
  "step": 4,`}
<span style={{ background: 'var(--df-red-dim)', display: 'block', margin: '0 -14px', padding: '0 14px', color: 'var(--df-red)' }}>{`-  "affected": null,            // validation failed`}</span>
<span style={{ background: 'var(--df-green-dim)', display: 'block', margin: '0 -14px', padding: '0 14px', color: 'var(--df-green)' }}>{`+  "affectedStep": "deploy/init-014",`}</span>
{`  "prior": "queued",
  "result": "active",
  "ts": "2026-06-21T14:02:11Z"
}`}</pre>
        </div>
      </div>
    );
  }

  /* ---------------- Table lens ---------------- */
  function TableLens({ objects, selectedId, onSelect }) {
    const cols = ['State', 'ID', 'Type', 'Title', 'Owner', 'Source', 'Observed'];
    return (
      <div style={{ height: '100%', overflow: 'auto', background: 'var(--surface-canvas)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <thead>
            <tr>{cols.map(c => (
              <th key={c} style={{ position: 'sticky', top: 0, textAlign: 'left', padding: '8px 12px', background: 'var(--surface-raised)', borderBottom: 'var(--border-default)', fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{c}</th>
            ))}</tr>
          </thead>
          <tbody>
            {objects.map(o => {
              const on = selectedId === o.id;
              return (
                <tr key={o.id} onClick={() => onSelect(o.id)} style={{ cursor: 'pointer', background: on ? 'var(--df-panel)' : 'transparent', borderLeft: on ? '2px solid var(--df-amber)' : '2px solid transparent' }}>
                  <td style={td}><StatePill state={o.state} /></td>
                  <td style={{ ...td, color: 'var(--text-primary)' }}>{o.id}</td>
                  <td style={{ ...td, fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)' }}>{o.type}</td>
                  <td style={{ ...td, fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title}</td>
                  <td style={{ ...td, color: 'var(--text-muted)' }}>{o.owner}</td>
                  <td style={{ ...td, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.source}</td>
                  <td style={{ ...td, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{o.observed}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
  const td = { padding: '6px 12px', borderBottom: 'var(--border-default)', whiteSpace: 'nowrap' };

  Object.assign(window, { CCDashboardLens: DashboardLens, CCTopologyLens: TopologyLens, CCIdeLens: IdeLens, CCTableLens: TableLens });
})();
