import React from 'react';

/**
 * Dreamfeed Select — a compact native dropdown styled to the panel system.
 * Use for lens pickers, density toggles, sort/filter keys.
 */
export function Select({ label, value, onChange, options = [], size = 'md', disabled = false, id, style, ...rest }) {
  const fieldId = id || React.useId();
  const heights = { sm: 'var(--control-h-sm)', md: 'var(--control-h-md)', lg: 'var(--control-h-lg)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', ...style }}>
      {label && (
        <label htmlFor={fieldId} style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-50)', fontWeight: 'var(--fw-medium)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <select
          id={fieldId}
          value={value}
          onChange={onChange}
          disabled={disabled}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            height: heights[size],
            width: '100%',
            padding: '0 26px 0 8px',
            background: 'var(--surface-sunken)',
            border: '1px solid var(--border-line)',
            borderRadius: 'var(--radius-1)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--fs-100)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            outline: 'none',
          }}
          {...rest}
        >
          {options.map((o) => {
            const opt = typeof o === 'string' ? { value: o, label: o } : o;
            return <option key={opt.value} value={opt.value}>{opt.label}</option>;
          })}
        </select>
        <span aria-hidden style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)', fontSize: '10px' }}>▾</span>
      </div>
    </div>
  );
}
