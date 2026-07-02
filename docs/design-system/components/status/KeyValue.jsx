import React from 'react';

/**
 * Dreamfeed KeyValue — a provenance / inspector detail row.
 * Sans label on the left, monospace source-backed value on the right.
 * Use for object metadata: type, owner, source path, last-observed timestamp.
 */
export function KeyValue({ label, value, mono = true, align = 'split', accent = null, style, children, ...rest }) {
  const valueColor = accent ? `var(--df-${accent})` : 'var(--text-primary)';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: align === 'split' ? 'space-between' : 'flex-start',
        gap: '16px',
        minHeight: '24px',
        padding: '3px 0',
        borderBottom: 'var(--border-default)',
        ...style,
      }}
      {...rest}
    >
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-75)', fontWeight: 'var(--fw-regular)', color: 'var(--text-muted)', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
        {label}
      </span>
      <span style={{
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        fontSize: 'var(--fs-75)',
        fontFeatureSettings: mono ? "'zero' 1, 'ss01' 1" : 'normal',
        fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
        color: valueColor,
        textAlign: 'right',
        wordBreak: 'break-all',
      }}>
        {children || value}
      </span>
    </div>
  );
}
