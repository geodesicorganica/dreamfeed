import React from 'react';

/**
 * Dreamfeed Switch — a binary mode toggle. State is signalled by KNOB POSITION
 * (never color alone): off = knob left on a sunken track, on = knob right on a
 * lighter raised track. Crisp <100ms transition, no spring. Optional text
 * labels reinforce the state.
 */
export function Switch({ checked = false, onChange, disabled = false, label = null, id, style, ...rest }) {
  const fieldId = id || React.useId();
  return (
    <label
      htmlFor={fieldId}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, ...style }}
    >
      <button
        id={fieldId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange && onChange(!checked)}
        style={{
          position: 'relative',
          width: '34px',
          height: '18px',
          flex: '0 0 auto',
          padding: 0,
          borderRadius: 'var(--radius-pill)',
          border: `1px solid ${checked ? 'var(--border-strong, #4A5152)' : 'var(--border-line)'}`,
          background: checked ? 'var(--df-panel-raised)' : 'var(--surface-sunken)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background var(--dur-instant) var(--ease-crisp), border-color var(--dur-instant) var(--ease-crisp)',
        }}
        {...rest}
      >
        <span
          style={{
            position: 'absolute',
            top: '2px',
            left: checked ? '18px' : '2px',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: checked ? 'var(--df-text-1)' : 'var(--text-muted)',
            transition: 'left var(--dur-quick) var(--ease-crisp), background var(--dur-instant) var(--ease-crisp)',
          }}
        />
      </button>
      {label && (
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-100)', color: 'var(--text-secondary)' }}>{label}</span>
      )}
    </label>
  );
}
