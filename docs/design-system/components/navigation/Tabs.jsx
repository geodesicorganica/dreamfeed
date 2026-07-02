import React from 'react';

/**
 * Dreamfeed Tabs — the View Registry lens switcher (and any segmented control).
 * The active lens is explicit: an underline tick + raised text weight. Crisp
 * switch, no sliding/springy indicator. Each tab may carry an optional icon
 * and a mono count.
 */
export function Tabs({ tabs = [], value, onChange, style, ...rest }) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: '2px',
        height: '34px',
        borderBottom: 'var(--border-default)',
        ...style,
      }}
      {...rest}
    >
      {tabs.map((t) => {
        const tab = typeof t === 'string' ? { value: t, label: t } : t;
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange && onChange(tab.value)}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 12px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--fs-75)',
              fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-medium)',
              letterSpacing: '0.02em',
              transition: 'color var(--dur-instant) var(--ease-crisp)',
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count != null && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-50)', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {tab.count}
              </span>
            )}
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: '-1px',
                height: '2px',
                background: active ? 'var(--text-primary)' : 'transparent',
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
