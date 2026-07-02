import React from 'react';

/**
 * Dreamfeed IconButton — square control for command-bar / region chrome.
 * Neutral by default; pass `active` to mark a held mode (selected lens, pinned).
 */
export function IconButton({
  size = 'md',
  active = false,
  disabled = false,
  label,
  onClick,
  style,
  children,
  ...rest
}) {
  const dim = { sm: 'var(--control-h-sm)', md: 'var(--control-h-md)', lg: 'var(--control-h-lg)' };
  const [hover, setHover] = React.useState(false);

  const bg = active ? 'var(--df-panel-raised)' : (hover && !disabled ? 'var(--df-panel)' : 'transparent');
  const border = active ? 'var(--border-strong, #4A5152)' : 'transparent';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: dim[size],
        height: dim[size],
        padding: 0,
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 'var(--radius-1)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'background var(--dur-instant) var(--ease-crisp)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
