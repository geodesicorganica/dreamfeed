import React from 'react';

/**
 * Dreamfeed TraceRow — one row of an Execution Trace Map / log ledger.
 * Each row names the state, the affected object, a mono detail/path, and a
 * timestamp — per the voice rule "every operational message names state,
 * object, source, timestamp, and next action". A left status tick carries the
 * state color; the text label is always present (color is never the only cue).
 */
const TICKS = {
  ok:      'var(--df-green)',
  active:  'var(--df-amber)',
  warn:    'var(--df-amber)',
  error:   'var(--df-red)',
  info:    'var(--df-cyan)',
  muted:   'var(--text-muted)',
};

export function TraceRow({
  status = 'muted',
  label,
  detail = null,
  timestamp = null,
  selected = false,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const tick = TICKS[status] || TICKS.muted;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: '10px',
        height: '26px',
        padding: '0 10px',
        background: selected ? 'var(--df-panel-raised)' : (hover && onClick ? 'var(--df-panel)' : 'transparent'),
        borderLeft: `2px solid ${selected ? tick : 'transparent'}`,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      {...rest}
    >
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: tick, flex: '0 0 auto' }} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0 }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-75)', fontWeight: 'var(--fw-medium)', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
        {detail && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-75)', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {detail}
          </span>
        )}
      </div>
      {timestamp && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-50)', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {timestamp}
        </span>
      )}
    </div>
  );
}
