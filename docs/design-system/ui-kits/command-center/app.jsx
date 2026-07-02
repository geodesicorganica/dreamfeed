/* Dreamfeed Command Center — Shell. Assembles the five persistent regions
   and the lens registry into one interactive cockpit. */
(function () {
  const DS = window.DreamfeedDesignSystem_7401df;
  const { Tabs } = DS;
  const Icon = window.CCIcon;

  function Shell() {
    const data = window.CC_DATA;
    const [nav, setNav] = React.useState('overview');
    const [lens, setLens] = React.useState('dashboard');
    const [selectedId, setSelectedId] = React.useState('work-205');
    const [selectedTrace, setSelectedTrace] = React.useState(3);
    const [live, setLive] = React.useState(true);
    const [density, setDensity] = React.useState('compact');

    React.useEffect(() => { if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.75 } }); });

    const pinned = data.objects.filter(o => ['init-009', 'init-014', 'work-205', 'rev-08'].includes(o.id));
    const obj = data.byId[selectedId];

    const LENS_TABS = [
      { value: 'dashboard', label: 'Dashboard', icon: <Icon name="layout-dashboard" size={14} /> },
      { value: 'topology', label: 'Topology', icon: <Icon name="share-2" size={14} />, count: data.topology.nodes.length },
      { value: 'ide', label: 'IDE', icon: <Icon name="terminal" size={14} /> },
      { value: 'table', label: 'Table', icon: <Icon name="table-2" size={14} />, count: data.objects.length },
    ];

    let canvas = null;
    if (lens === 'dashboard') canvas = <window.CCDashboardLens objects={data.objects} onSelect={setSelectedId} />;
    else if (lens === 'topology') canvas = <window.CCTopologyLens topology={data.topology} selectedId={selectedId} onSelect={setSelectedId} />;
    else if (lens === 'ide') canvas = <window.CCIdeLens onSelect={setSelectedId} />;
    else if (lens === 'table') canvas = <window.CCTableLens objects={data.objects} selectedId={selectedId} onSelect={setSelectedId} />;

    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', background: 'var(--surface-canvas)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
        <window.CCSidebar active={nav} onNav={setNav} pinned={pinned} onSelect={setSelectedId} selectedId={selectedId} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <window.CCCommandBar live={live} onLive={setLive} density={density} onDensity={setDensity} />
          <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface-canvas)' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: 'var(--border-default)', background: 'var(--surface-canvas)' }}>
                <div style={{ flex: 1 }}>
                  <Tabs value={lens} onChange={setLens} tabs={LENS_TABS} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{lens} lens</span>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>{canvas}</div>
            </main>
            <window.CCInspector obj={obj} onSelect={setSelectedId} />
          </div>
          <window.CCBottomPanel traces={data.traces} selectedTrace={selectedTrace} onSelectTrace={setSelectedTrace} />
        </div>
      </div>
    );
  }

  window.CCShell = Shell;
})();
