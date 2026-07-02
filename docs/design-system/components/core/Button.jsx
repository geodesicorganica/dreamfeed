import React from 'react';

/**
 * Dreamfeed Button — neutral, industrial command control.
 * Color is reserved for STATE, so even the primary button is a neutral raised
 * fill, never amber/green. `danger` uses Off-Nominal Red only for destructive
 * actions. Crisp <100ms local feedback; no springy/atmospheric motion.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  disabled = false,
  iconLeft = null,
  iconRight = null,
  type = 'button',
  onClick,
  style,
  children,
  ...rest
}) {
  const heights = { sm: 'var(--control-h-sm)', md: 'var(--control-h-md)', lg: 'var(--control-h-lg)' };
  const fontSizes = { sm: 'var(--fs-50)', md: 'var(--fs-75)', lg: 'var(--fs-200)' };
  const padX = { sm: '8px', md: '12px', lg: '16px' };

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    height: heights[size],
    padding: `0 ${padX[size]}`,
    fontFamily: 'var(--font-sans)',
    fontSize: fontSizes[size],
    fontWeight: 'var(--fw-medium)',
    lineHeight: 1,
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap',
    border: '1px solid transparent',
    borderRadius: 'var(--radius-1)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    transition: 'background var(--dur-instant) var(--ease-crisp), border-color var(--dur-instant) var(--ease-crisp)',
    userSelect: 'none',
  };

  const variants = {
    primary: { background: '#3B4244', color: 'var(--text-primary)', borderColor: '#4A5152' },
    secondary: { background: 'transparent', color: 'var(--text-primary)', borderColor: 'var(--border-line)' },
    ghost: { background: 'transparent', color: 'var(--text-secondary)', borderColor: 'transparent' },
    danger: { background: 'transparent', color: 'var(--state-error)', borderColor: 'rgba(224,107,100,0.55)' },
  };

  const [hover, setHover] = React.useState(false);
  const hoverPatch = !disabled && hover ? {
    primary: { background: '#434B4D' },
    secondary: { background: 'var(--df-panel)' },
    ghost: { background: 'var(--df-panel)', color: 'var(--text-primary)' },
    danger: { background: 'var(--df-red-dim)' },
  }[variant] : null;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...base, ...variants[variant], ...hoverPatch, ...style }}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
