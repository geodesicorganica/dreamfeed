import React from 'react';

/**
 * Dreamfeed StatePill — the canonical operational state indicator.
 * Color is NEVER the only signal: every pill carries an explicit text label,
 * and accepts an optional timestamp for freshness. Functional Green is used
 * only for verified/live/passed record states; amber for observe/active;
 * red for halt/failure; neutral grays for stale/pending/idle.
 */
const STATES = {
  // ---- Green: verified / passed / live record states ----
  live:     { label: 'LIVE',     color: 'var(--df-green)', dim: 'var(--df-green-dim)' },
  verified: { label: 'VERIFIED', color: 'var(--df-green)', dim: 'var(--df-green-dim)' },
  passed:   { label: 'PASSED',   color: 'var(--df-green)', dim: 'var(--df-green-dim)' },
  accepted: { label: 'ACCEPTED', color: 'var(--df-green)', dim: 'var(--df-green-dim)' },
  buildok:  { label: 'BUILD\u00B7OK', color: 'var(--df-green)', dim: 'var(--df-green-dim)' },
  // ---- Amber: active process / warning / queue delay ----
  active:   { label: 'ACTIVE',   color: 'var(--df-amber)', dim: 'var(--df-amber-dim)' },
  running:  { label: 'RUNNING',  color: 'var(--df-amber)', dim: 'var(--df-amber-dim)' },
  queued:   { label: 'QUEUED',   color: 'var(--df-amber)', dim: 'var(--df-amber-dim)' },
  warning:  { label: 'WARNING',  color: 'var(--df-amber)', dim: 'var(--df-amber-dim)' },
  // ---- Red: halt / failure / blockage ----
  halted:   { label: 'HALTED',   color: 'var(--df-red)',   dim: 'var(--df-red-dim)' },
  blocked:  { label: 'BLOCKED',  color: 'var(--df-red)',   dim: 'var(--df-red-dim)' },
  failed:   { label: 'FAILED',   color: 'var(--df-red)',   dim: 'var(--df-red-dim)' },
  // ---- Cyan: selection / focus / informational ----
  selected: { label: 'SELECTED', color: 'var(--df-cyan)',  dim: 'var(--df-cyan-dim)' },
  info:     { label: 'INFO',     color: 'var(--df-cyan)',  dim: 'var(--df-cyan-dim)' },
  pending:  { label: 'PENDING',  color: 'var(--df-cyan)',  dim: 'var(--df-cyan-dim)' },
  // ---- Neutral: nominal / silent ----
  idle:     { label: 'IDLE',     color: 'var(--text-muted)', dim: 'var(--df-panel-raised)' },
  locked:   { label: 'LOCKED',   color: 'var(--text-muted)', dim: 'var(--df-panel-raised)' },
  archived: { label: 'ARCHIVED', color: 'var(--text-muted)', dim: 'var(--df-panel-raised)' },
  stale:    { label: 'STALE',    color: 'var(--text-muted)', dim: 'var(--df-panel-raised)' },
};

export function StatePill({ state = 'idle', label, timestamp = null, filled = false, style, ...rest }) {
  const s = STATES[state] || STATES.idle;
  const text = label || s.label;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        height: '20px',
        padding: '0 8px 0 7px',
        borderRadius: 'var(--radius-1)',
        border: `1px solid ${filled ? 'transparent' : 'var(--border-line)'}`,
        background: filled ? s.dim : 'transparent',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--fs-50)',
        fontWeight: 'var(--fw-semibold)',
        letterSpacing: '0.06em',
        color: 'var(--text-secondary)',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      <span style={{ width: '7px', height: '7px', borderRadius: 'var(--radius-pill)', background: s.color, flex: '0 0 auto' }} />
      <span style={{ color: s.color === 'var(--text-muted)' ? 'var(--text-muted)' : 'var(--text-primary)' }}>{text}</span>
      {timestamp && (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-regular)', letterSpacing: 0, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {timestamp}
        </span>
      )}
    </span>
  );
}
