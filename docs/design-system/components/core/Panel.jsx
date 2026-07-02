import React from 'react';

/**
 * Dreamfeed Panel — a depth-plane surface for the five persistent regions.
 * `surface` maps to the brand's flat depth layers (canvas < panel < raised).
 * A raised panel signals an active command / inspection / trace context — not a
 * generic decorative card. Optional region header with an overline label.
 */
export function Panel({
  surface = 'panel',
  title = null,
  meta = null,
  actions = null,
  padded = true,
  bordered = true,
  style,
  bodyStyle,
  children,
  ...rest
}) {
  const surfaces = {
    canvas: 'var(--surface-canvas)',
    panel: 'var(--surface-panel)',
    raised: 'var(--surface-raised)',
    sunken: 'var(--surface-sunken)',
  };

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: surfaces[surface],
        border: bordered ? 'var(--border-default)' : 'none',
        borderRadius: 'var(--radius-2)',
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    >
      {title !== null && (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '0 12px',
            height: '34px',
            flex: '0 0 auto',
            borderBottom: 'var(--border-default)',
            background: surface === 'raised' ? 'var(--surface-raised)' : 'transparent',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', minWidth: 0 }}>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--fs-50)',
                fontWeight: 'var(--fw-semibold)',
                letterSpacing: 'var(--ls-caps)',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </span>
            {meta && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-50)', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {meta}
              </span>
            )}
          </div>
          {actions && <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>{actions}</div>}
        </header>
      )}
      <div style={{ flex: '1 1 auto', minHeight: 0, padding: padded ? '12px' : 0, ...bodyStyle }}>
        {children}
      </div>
    </section>
  );
}
