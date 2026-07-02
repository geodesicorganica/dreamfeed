import React from 'react';

/**
 * Dreamfeed TextField — a single-line input seated in a sunken well.
 * Use `mono` for command / path / ID / schema entry (the canonical data face).
 * Always pairs with a structural label; supports an error state with text.
 */
export function TextField({
  label,
  value,
  onChange,
  placeholder = '',
  mono = false,
  prefix = null,
  size = 'md',
  error = null,
  disabled = false,
  id,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const fieldId = id || React.useId();
  const heights = { sm: 'var(--control-h-sm)', md: 'var(--control-h-md)', lg: 'var(--control-h-lg)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', ...style }}>
      {label && (
        <label htmlFor={fieldId} style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-50)', fontWeight: 'var(--fw-medium)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {label}
        </label>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          height: heights[size],
          padding: '0 8px',
          background: 'var(--surface-sunken)',
          border: `1px solid ${error ? 'var(--df-red)' : (focus ? 'var(--df-cyan)' : 'var(--border-line)')}`,
          boxShadow: focus ? '0 0 0 2px rgba(126,207,209,0.18)' : 'var(--shadow-inset-well)',
          borderRadius: 'var(--radius-1)',
          opacity: disabled ? 0.5 : 1,
          transition: 'border-color var(--dur-instant) var(--ease-crisp)',
        }}
      >
        {prefix && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-75)', color: 'var(--text-muted)' }}>{prefix}</span>}
        <input
          id={fieldId}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'var(--text-primary)',
            fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
            fontSize: 'var(--fs-100)',
            fontFeatureSettings: mono ? "'zero' 1, 'ss01' 1" : 'normal',
          }}
          {...rest}
        />
      </div>
      {error && (
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-50)', color: 'var(--df-red)' }}>{error}</span>
      )}
    </div>
  );
}
