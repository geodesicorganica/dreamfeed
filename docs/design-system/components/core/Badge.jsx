import React from 'react';

/**
 * Dreamfeed Badge — a small count / label chip.
 * Neutral by default. A `tone` may tint it to a functional state color, but a
 * badge must still carry legible text (never color-only). Use `mono` for
 * IDs / counts / versions.
 */
export function Badge({ tone = 'neutral', mono = false, style, children, ...rest }) {
  const tones = {
    neutral: { bg: 'var(--df-panel-raised)', fg: 'var(--text-secondary)', bd: 'var(--border-line)' },
    info: { bg: 'var(--df-cyan-dim)', fg: 'var(--df-cyan)', bd: 'rgba(126,207,209,0.4)' },
    ok: { bg: 'var(--df-green-dim)', fg: 'var(--df-green)', bd: 'rgba(111,191,138,0.4)' },
    warn: { bg: 'var(--df-amber-dim)', fg: 'var(--df-amber)', bd: 'rgba(214,166,90,0.45)' },
    error: { bg: 'var(--df-red-dim)', fg: 'var(--df-red)', bd: 'rgba(224,107,100,0.45)' },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: '18px',
        padding: '0 6px',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        fontSize: 'var(--fs-50)',
        fontWeight: 'var(--fw-medium)',
        letterSpacing: mono ? 0 : '0.02em',
        fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
        color: t.fg,
        background: t.bg,
        border: `1px solid ${t.bd}`,
        borderRadius: 'var(--radius-1)',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
