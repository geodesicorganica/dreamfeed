/* @ds-bundle: {"format":3,"namespace":"DreamfeedDesignSystem_7401df","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Panel","sourcePath":"components/core/Panel.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"TextField","sourcePath":"components/forms/TextField.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"KeyValue","sourcePath":"components/status/KeyValue.jsx"},{"name":"StatePill","sourcePath":"components/status/StatePill.jsx"},{"name":"TraceRow","sourcePath":"components/status/TraceRow.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"4ce37d950f4e","components/core/Button.jsx":"18ae0bc46b46","components/core/IconButton.jsx":"5ea8ee775a80","components/core/Panel.jsx":"4228ff040575","components/forms/Select.jsx":"290d20ad746b","components/forms/Switch.jsx":"b8a6c5d1420c","components/forms/TextField.jsx":"d45723e6c014","components/navigation/Tabs.jsx":"4506065c1b0f","components/status/KeyValue.jsx":"1c6c391d9927","components/status/StatePill.jsx":"1d155f497b02","components/status/TraceRow.jsx":"db209edbe755","ui_kits/command-center/app.jsx":"0103e85163d7","ui_kits/command-center/data.js":"1d9529460393","ui_kits/command-center/lenses.jsx":"7a223efedbc3","ui_kits/command-center/regions.jsx":"a932496db51e"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.DreamfeedDesignSystem_7401df = window.DreamfeedDesignSystem_7401df || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Dreamfeed Badge — a small count / label chip.
 * Neutral by default. A `tone` may tint it to a functional state color, but a
 * badge must still carry legible text (never color-only). Use `mono` for
 * IDs / counts / versions.
 */
function Badge({
  tone = 'neutral',
  mono = false,
  style,
  children,
  ...rest
}) {
  const tones = {
    neutral: {
      bg: 'var(--df-panel-raised)',
      fg: 'var(--text-secondary)',
      bd: 'var(--border-line)'
    },
    info: {
      bg: 'var(--df-cyan-dim)',
      fg: 'var(--df-cyan)',
      bd: 'rgba(126,207,209,0.4)'
    },
    ok: {
      bg: 'var(--df-green-dim)',
      fg: 'var(--df-green)',
      bd: 'rgba(111,191,138,0.4)'
    },
    warn: {
      bg: 'var(--df-amber-dim)',
      fg: 'var(--df-amber)',
      bd: 'rgba(214,166,90,0.45)'
    },
    error: {
      bg: 'var(--df-red-dim)',
      fg: 'var(--df-red)',
      bd: 'rgba(224,107,100,0.45)'
    }
  };
  const t = tones[tone] || tones.neutral;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
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
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Dreamfeed Button — neutral, industrial command control.
 * Color is reserved for STATE, so even the primary button is a neutral raised
 * fill, never amber/green. `danger` uses Off-Nominal Red only for destructive
 * actions. Crisp <100ms local feedback; no springy/atmospheric motion.
 */
function Button({
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
  const heights = {
    sm: 'var(--control-h-sm)',
    md: 'var(--control-h-md)',
    lg: 'var(--control-h-lg)'
  };
  const fontSizes = {
    sm: 'var(--fs-50)',
    md: 'var(--fs-75)',
    lg: 'var(--fs-200)'
  };
  const padX = {
    sm: '8px',
    md: '12px',
    lg: '16px'
  };
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
    userSelect: 'none'
  };
  const variants = {
    primary: {
      background: '#3B4244',
      color: 'var(--text-primary)',
      borderColor: '#4A5152'
    },
    secondary: {
      background: 'transparent',
      color: 'var(--text-primary)',
      borderColor: 'var(--border-line)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
      borderColor: 'transparent'
    },
    danger: {
      background: 'transparent',
      color: 'var(--state-error)',
      borderColor: 'rgba(224,107,100,0.55)'
    }
  };
  const [hover, setHover] = React.useState(false);
  const hoverPatch = !disabled && hover ? {
    primary: {
      background: '#434B4D'
    },
    secondary: {
      background: 'var(--df-panel)'
    },
    ghost: {
      background: 'var(--df-panel)',
      color: 'var(--text-primary)'
    },
    danger: {
      background: 'var(--df-red-dim)'
    }
  }[variant] : null;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      ...base,
      ...variants[variant],
      ...hoverPatch,
      ...style
    }
  }, rest), iconLeft, children, iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Dreamfeed IconButton — square control for command-bar / region chrome.
 * Neutral by default; pass `active` to mark a held mode (selected lens, pinned).
 */
function IconButton({
  size = 'md',
  active = false,
  disabled = false,
  label,
  onClick,
  style,
  children,
  ...rest
}) {
  const dim = {
    sm: 'var(--control-h-sm)',
    md: 'var(--control-h-md)',
    lg: 'var(--control-h-lg)'
  };
  const [hover, setHover] = React.useState(false);
  const bg = active ? 'var(--df-panel-raised)' : hover && !disabled ? 'var(--df-panel)' : 'transparent';
  const border = active ? 'var(--border-strong, #4A5152)' : 'transparent';
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    title: label,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
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
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Panel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Dreamfeed Panel — a depth-plane surface for the five persistent regions.
 * `surface` maps to the brand's flat depth layers (canvas < panel < raised).
 * A raised panel signals an active command / inspection / trace context — not a
 * generic decorative card. Optional region header with an overline label.
 */
function Panel({
  surface = 'panel',
  title = null,
  meta = null,
  actions = null,
  padded = true,
  bordered = true,
  style,
  bodyStyle,
  children,
  ...rest
}) {
  const surfaces = {
    canvas: 'var(--surface-canvas)',
    panel: 'var(--surface-panel)',
    raised: 'var(--surface-raised)',
    sunken: 'var(--surface-sunken)'
  };
  return /*#__PURE__*/React.createElement("section", _extends({
    style: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      background: surfaces[surface],
      border: bordered ? 'var(--border-default)' : 'none',
      borderRadius: 'var(--radius-2)',
      overflow: 'hidden',
      ...style
    }
  }, rest), title !== null && /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      padding: '0 12px',
      height: '34px',
      flex: '0 0 auto',
      borderBottom: 'var(--border-default)',
      background: surface === 'raised' ? 'var(--surface-raised)' : 'transparent'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: '10px',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--fs-50)',
      fontWeight: 'var(--fw-semibold)',
      letterSpacing: 'var(--ls-caps)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      whiteSpace: 'nowrap'
    }
  }, title), meta && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-50)',
      color: 'var(--text-muted)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, meta)), actions && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    }
  }, actions)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 auto',
      minHeight: 0,
      padding: padded ? '12px' : 0,
      ...bodyStyle
    }
  }, children));
}
Object.assign(__ds_scope, { Panel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Panel.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Dreamfeed Select — a compact native dropdown styled to the panel system.
 * Use for lens pickers, density toggles, sort/filter keys.
 */
function Select({
  label,
  value,
  onChange,
  options = [],
  size = 'md',
  disabled = false,
  id,
  style,
  ...rest
}) {
  const fieldId = id || React.useId();
  const heights = {
    sm: 'var(--control-h-sm)',
    md: 'var(--control-h-md)',
    lg: 'var(--control-h-lg)'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: fieldId,
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--fs-50)',
      fontWeight: 'var(--fw-medium)',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'inline-flex'
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: fieldId,
    value: value,
    onChange: onChange,
    disabled: disabled,
    style: {
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
      outline: 'none'
    }
  }, rest), options.map(o => {
    const opt = typeof o === 'string' ? {
      value: o,
      label: o
    } : o;
    return /*#__PURE__*/React.createElement("option", {
      key: opt.value,
      value: opt.value
    }, opt.label);
  })), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    style: {
      position: 'absolute',
      right: '8px',
      top: '50%',
      transform: 'translateY(-50%)',
      pointerEvents: 'none',
      color: 'var(--text-muted)',
      fontSize: '10px'
    }
  }, "\u25BE")));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Dreamfeed Switch — a binary mode toggle. State is signalled by KNOB POSITION
 * (never color alone): off = knob left on a sunken track, on = knob right on a
 * lighter raised track. Crisp <100ms transition, no spring. Optional text
 * labels reinforce the state.
 */
function Switch({
  checked = false,
  onChange,
  disabled = false,
  label = null,
  id,
  style,
  ...rest
}) {
  const fieldId = id || React.useId();
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: fieldId,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", _extends({
    id: fieldId,
    type: "button",
    role: "switch",
    "aria-checked": checked,
    disabled: disabled,
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      position: 'relative',
      width: '34px',
      height: '18px',
      flex: '0 0 auto',
      padding: 0,
      borderRadius: 'var(--radius-pill)',
      border: `1px solid ${checked ? 'var(--border-strong, #4A5152)' : 'var(--border-line)'}`,
      background: checked ? 'var(--df-panel-raised)' : 'var(--surface-sunken)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background var(--dur-instant) var(--ease-crisp), border-color var(--dur-instant) var(--ease-crisp)'
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: '2px',
      left: checked ? '18px' : '2px',
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      background: checked ? 'var(--df-text-1)' : 'var(--text-muted)',
      transition: 'left var(--dur-quick) var(--ease-crisp), background var(--dur-instant) var(--ease-crisp)'
    }
  })), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--fs-100)',
      color: 'var(--text-secondary)'
    }
  }, label));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/forms/TextField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Dreamfeed TextField — a single-line input seated in a sunken well.
 * Use `mono` for command / path / ID / schema entry (the canonical data face).
 * Always pairs with a structural label; supports an error state with text.
 */
function TextField({
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
  const heights = {
    sm: 'var(--control-h-sm)',
    md: 'var(--control-h-md)',
    lg: 'var(--control-h-lg)'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: fieldId,
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--fs-50)',
      fontWeight: 'var(--fw-medium)',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      height: heights[size],
      padding: '0 8px',
      background: 'var(--surface-sunken)',
      border: `1px solid ${error ? 'var(--df-red)' : focus ? 'var(--df-cyan)' : 'var(--border-line)'}`,
      boxShadow: focus ? '0 0 0 2px rgba(126,207,209,0.18)' : 'var(--shadow-inset-well)',
      borderRadius: 'var(--radius-1)',
      opacity: disabled ? 0.5 : 1,
      transition: 'border-color var(--dur-instant) var(--ease-crisp)'
    }
  }, prefix && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-75)',
      color: 'var(--text-muted)'
    }
  }, prefix), /*#__PURE__*/React.createElement("input", _extends({
    id: fieldId,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      height: '100%',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: 'var(--text-primary)',
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
      fontSize: 'var(--fs-100)',
      fontFeatureSettings: mono ? "'zero' 1, 'ss01' 1" : 'normal'
    }
  }, rest))), error && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--fs-50)',
      color: 'var(--df-red)'
    }
  }, error));
}
Object.assign(__ds_scope, { TextField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/TextField.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Dreamfeed Tabs — the View Registry lens switcher (and any segmented control).
 * The active lens is explicit: an underline tick + raised text weight. Crisp
 * switch, no sliding/springy indicator. Each tab may carry an optional icon
 * and a mono count.
 */
function Tabs({
  tabs = [],
  value,
  onChange,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "tablist",
    style: {
      display: 'flex',
      alignItems: 'stretch',
      gap: '2px',
      height: '34px',
      borderBottom: 'var(--border-default)',
      ...style
    }
  }, rest), tabs.map(t => {
    const tab = typeof t === 'string' ? {
      value: t,
      label: t
    } : t;
    const active = tab.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: tab.value,
      role: "tab",
      "aria-selected": active,
      onClick: () => onChange && onChange(tab.value),
      style: {
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
        transition: 'color var(--dur-instant) var(--ease-crisp)'
      }
    }, tab.icon, /*#__PURE__*/React.createElement("span", null, tab.label), tab.count != null && /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-50)',
        color: 'var(--text-muted)',
        fontVariantNumeric: 'tabular-nums'
      }
    }, tab.count), /*#__PURE__*/React.createElement("span", {
      "aria-hidden": true,
      style: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: '-1px',
        height: '2px',
        background: active ? 'var(--text-primary)' : 'transparent'
      }
    }));
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/status/KeyValue.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Dreamfeed KeyValue — a provenance / inspector detail row.
 * Sans label on the left, monospace source-backed value on the right.
 * Use for object metadata: type, owner, source path, last-observed timestamp.
 */
function KeyValue({
  label,
  value,
  mono = true,
  align = 'split',
  accent = null,
  style,
  children,
  ...rest
}) {
  const valueColor = accent ? `var(--df-${accent})` : 'var(--text-primary)';
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: align === 'split' ? 'space-between' : 'flex-start',
      gap: '16px',
      minHeight: '24px',
      padding: '3px 0',
      borderBottom: 'var(--border-default)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--fs-75)',
      fontWeight: 'var(--fw-regular)',
      color: 'var(--text-muted)',
      whiteSpace: 'nowrap',
      flex: '0 0 auto'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
      fontSize: 'var(--fs-75)',
      fontFeatureSettings: mono ? "'zero' 1, 'ss01' 1" : 'normal',
      fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
      color: valueColor,
      textAlign: 'right',
      wordBreak: 'break-all'
    }
  }, children || value));
}
Object.assign(__ds_scope, { KeyValue });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/status/KeyValue.jsx", error: String((e && e.message) || e) }); }

// components/status/StatePill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Dreamfeed StatePill — the canonical operational state indicator.
 * Color is NEVER the only signal: every pill carries an explicit text label,
 * and accepts an optional timestamp for freshness. Functional Green is used
 * only for verified/live/passed record states; amber for observe/active;
 * red for halt/failure; neutral grays for stale/pending/idle.
 */
const STATES = {
  // ---- Green: verified / passed / live record states ----
  live: {
    label: 'LIVE',
    color: 'var(--df-green)',
    dim: 'var(--df-green-dim)'
  },
  verified: {
    label: 'VERIFIED',
    color: 'var(--df-green)',
    dim: 'var(--df-green-dim)'
  },
  passed: {
    label: 'PASSED',
    color: 'var(--df-green)',
    dim: 'var(--df-green-dim)'
  },
  accepted: {
    label: 'ACCEPTED',
    color: 'var(--df-green)',
    dim: 'var(--df-green-dim)'
  },
  buildok: {
    label: 'BUILD\u00B7OK',
    color: 'var(--df-green)',
    dim: 'var(--df-green-dim)'
  },
  // ---- Amber: active process / warning / queue delay ----
  active: {
    label: 'ACTIVE',
    color: 'var(--df-amber)',
    dim: 'var(--df-amber-dim)'
  },
  running: {
    label: 'RUNNING',
    color: 'var(--df-amber)',
    dim: 'var(--df-amber-dim)'
  },
  queued: {
    label: 'QUEUED',
    color: 'var(--df-amber)',
    dim: 'var(--df-amber-dim)'
  },
  warning: {
    label: 'WARNING',
    color: 'var(--df-amber)',
    dim: 'var(--df-amber-dim)'
  },
  // ---- Red: halt / failure / blockage ----
  halted: {
    label: 'HALTED',
    color: 'var(--df-red)',
    dim: 'var(--df-red-dim)'
  },
  blocked: {
    label: 'BLOCKED',
    color: 'var(--df-red)',
    dim: 'var(--df-red-dim)'
  },
  failed: {
    label: 'FAILED',
    color: 'var(--df-red)',
    dim: 'var(--df-red-dim)'
  },
  // ---- Cyan: selection / focus / informational ----
  selected: {
    label: 'SELECTED',
    color: 'var(--df-cyan)',
    dim: 'var(--df-cyan-dim)'
  },
  info: {
    label: 'INFO',
    color: 'var(--df-cyan)',
    dim: 'var(--df-cyan-dim)'
  },
  pending: {
    label: 'PENDING',
    color: 'var(--df-cyan)',
    dim: 'var(--df-cyan-dim)'
  },
  // ---- Neutral: nominal / silent ----
  idle: {
    label: 'IDLE',
    color: 'var(--text-muted)',
    dim: 'var(--df-panel-raised)'
  },
  locked: {
    label: 'LOCKED',
    color: 'var(--text-muted)',
    dim: 'var(--df-panel-raised)'
  },
  archived: {
    label: 'ARCHIVED',
    color: 'var(--text-muted)',
    dim: 'var(--df-panel-raised)'
  },
  stale: {
    label: 'STALE',
    color: 'var(--text-muted)',
    dim: 'var(--df-panel-raised)'
  }
};
function StatePill({
  state = 'idle',
  label,
  timestamp = null,
  filled = false,
  style,
  ...rest
}) {
  const s = STATES[state] || STATES.idle;
  const text = label || s.label;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
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
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: '7px',
      height: '7px',
      borderRadius: 'var(--radius-pill)',
      background: s.color,
      flex: '0 0 auto'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: s.color === 'var(--text-muted)' ? 'var(--text-muted)' : 'var(--text-primary)'
    }
  }, text), timestamp && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontWeight: 'var(--fw-regular)',
      letterSpacing: 0,
      color: 'var(--text-muted)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, timestamp));
}
Object.assign(__ds_scope, { StatePill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/status/StatePill.jsx", error: String((e && e.message) || e) }); }

// components/status/TraceRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Dreamfeed TraceRow — one row of an Execution Trace Map / log ledger.
 * Each row names the state, the affected object, a mono detail/path, and a
 * timestamp — per the voice rule "every operational message names state,
 * object, source, timestamp, and next action". A left status tick carries the
 * state color; the text label is always present (color is never the only cue).
 */
const TICKS = {
  ok: 'var(--df-green)',
  active: 'var(--df-amber)',
  warn: 'var(--df-amber)',
  error: 'var(--df-red)',
  info: 'var(--df-cyan)',
  muted: 'var(--text-muted)'
};
function TraceRow({
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
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      alignItems: 'center',
      gap: '10px',
      height: '26px',
      padding: '0 10px',
      background: selected ? 'var(--df-panel-raised)' : hover && onClick ? 'var(--df-panel)' : 'transparent',
      borderLeft: `2px solid ${selected ? tick : 'transparent'}`,
      cursor: onClick ? 'pointer' : 'default',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      background: tick,
      flex: '0 0 auto'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: '8px',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--fs-75)',
      fontWeight: 'var(--fw-medium)',
      color: 'var(--text-primary)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, label), detail && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-75)',
      color: 'var(--text-muted)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, detail)), timestamp && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-50)',
      color: 'var(--text-muted)',
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap'
    }
  }, timestamp));
}
Object.assign(__ds_scope, { TraceRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/status/TraceRow.jsx", error: String((e && e.message) || e) }); }

// ui_kits/command-center/app.jsx
try { (() => {
/* Dreamfeed Command Center — Shell. Assembles the five persistent regions
   and the lens registry into one interactive cockpit. */
(function () {
  const DS = window.DreamfeedDesignSystem_7401df;
  const {
    Tabs
  } = DS;
  const Icon = window.CCIcon;
  function Shell() {
    const data = window.CC_DATA;
    const [nav, setNav] = React.useState('overview');
    const [lens, setLens] = React.useState('dashboard');
    const [selectedId, setSelectedId] = React.useState('work-205');
    const [selectedTrace, setSelectedTrace] = React.useState(3);
    const [live, setLive] = React.useState(true);
    const [density, setDensity] = React.useState('compact');
    React.useEffect(() => {
      if (window.lucide) window.lucide.createIcons({
        attrs: {
          'stroke-width': 1.75
        }
      });
    });
    const pinned = data.objects.filter(o => ['init-009', 'init-014', 'work-205', 'rev-08'].includes(o.id));
    const obj = data.byId[selectedId];
    const LENS_TABS = [{
      value: 'dashboard',
      label: 'Dashboard',
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "layout-dashboard",
        size: 14
      })
    }, {
      value: 'topology',
      label: 'Topology',
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "share-2",
        size: 14
      }),
      count: data.topology.nodes.length
    }, {
      value: 'ide',
      label: 'IDE',
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "terminal",
        size: 14
      })
    }, {
      value: 'table',
      label: 'Table',
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "table-2",
        size: 14
      }),
      count: data.objects.length
    }];
    let canvas = null;
    if (lens === 'dashboard') canvas = /*#__PURE__*/React.createElement(window.CCDashboardLens, {
      objects: data.objects,
      onSelect: setSelectedId
    });else if (lens === 'topology') canvas = /*#__PURE__*/React.createElement(window.CCTopologyLens, {
      topology: data.topology,
      selectedId: selectedId,
      onSelect: setSelectedId
    });else if (lens === 'ide') canvas = /*#__PURE__*/React.createElement(window.CCIdeLens, {
      onSelect: setSelectedId
    });else if (lens === 'table') canvas = /*#__PURE__*/React.createElement(window.CCTableLens, {
      objects: data.objects,
      selectedId: selectedId,
      onSelect: setSelectedId
    });
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'fixed',
        inset: 0,
        display: 'flex',
        background: 'var(--surface-canvas)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)'
      }
    }, /*#__PURE__*/React.createElement(window.CCSidebar, {
      active: nav,
      onNav: setNav,
      pinned: pinned,
      onSelect: setSelectedId,
      selectedId: selectedId
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column'
      }
    }, /*#__PURE__*/React.createElement(window.CCCommandBar, {
      live: live,
      onLive: setLive,
      density: density,
      onDensity: setDensity
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minHeight: 0,
        display: 'flex'
      }
    }, /*#__PURE__*/React.createElement("main", {
      style: {
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-canvas)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        borderBottom: 'var(--border-default)',
        background: 'var(--surface-canvas)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(Tabs, {
      value: lens,
      onChange: setLens,
      tabs: LENS_TABS
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-muted)'
      }
    }, lens, " lens")), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minHeight: 0
      }
    }, canvas)), /*#__PURE__*/React.createElement(window.CCInspector, {
      obj: obj,
      onSelect: setSelectedId
    })), /*#__PURE__*/React.createElement(window.CCBottomPanel, {
      traces: data.traces,
      selectedTrace: selectedTrace,
      onSelectTrace: setSelectedTrace
    })));
  }
  window.CCShell = Shell;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/command-center/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/command-center/data.js
try { (() => {
/* Dreamfeed Command Center — fake typed-object data for the UI kit recreation.
   Mirrors the Unified Typed Object Model (command-center-primitives.md):
   every object exposes type, title, state, owner, source, last-observed, relations. */
window.CC_DATA = function () {
  const objects = [{
    id: 'init-014',
    type: 'Strategic initiative',
    title: 'Phase 1.3 — IDE substitution',
    state: 'active',
    owner: 'founder',
    source: 'docs/strategy/ROADMAP.md',
    observed: '14:02Z',
    detail: 'Replace VSCode+Claude Code path with the Command Center IDE lens.',
    rels: ['work-221', 'work-219', 'rev-08']
  }, {
    id: 'init-009',
    type: 'Strategic initiative',
    title: 'Command Center MVP V1',
    state: 'live',
    owner: 'founder',
    source: 'tools/command-center/',
    observed: '14:02Z',
    detail: 'Localhost-only, read-only operating cockpit. LIVE.',
    rels: ['work-205', 'mile-03']
  }, {
    id: 'work-221',
    type: 'Work item',
    title: 'Topology lens: edge selection + provenance',
    state: 'active',
    owner: 'agent-ui',
    source: 'src/lenses/topology.tsx',
    observed: '14:02Z',
    detail: 'Node/edge selection wired to inspector. Provenance read-only in V1.',
    rels: ['init-014', 'skill-graph']
  }, {
    id: 'work-219',
    type: 'Work item',
    title: 'Inspector: object provenance rows',
    state: 'verified',
    owner: 'agent-ui',
    source: 'src/regions/inspector.tsx',
    observed: '13:58Z',
    detail: 'KeyValue provenance rows shipped, audit passed.',
    rels: ['init-014']
  }, {
    id: 'work-205',
    type: 'Work item',
    title: 'Bottom panel: execution trace map',
    state: 'blocked',
    owner: 'agent-core',
    source: 'src/regions/bottom.tsx',
    observed: '14:01Z',
    detail: 'Blocked: trace step schema validation failing.',
    rels: ['init-009', 'rev-08']
  }, {
    id: 'work-188',
    type: 'Work item',
    title: 'Slashed-zero font build',
    state: 'queued',
    owner: 'agent-ui',
    source: 'tokens/typography.css',
    observed: '13:40Z',
    detail: 'Queued behind font pipeline.',
    rels: []
  }, {
    id: 'appr-07',
    type: 'Approval',
    title: 'Deploy gate: V1 read-only boundary',
    state: 'pending',
    owner: 'founder',
    source: 'CLAUDE.md',
    observed: '14:00Z',
    detail: 'Awaiting founder approval to lock read-only boundary.',
    rels: ['init-009']
  }, {
    id: 'rev-08',
    type: 'Review',
    title: 'Trace schema review',
    state: 'failed',
    owner: 'agent-core',
    source: 'src/schema/trace.json',
    observed: '14:01Z',
    detail: 'Validation failed: DF-LIVE-ROLLBACK-001 missing affected-step field.',
    rels: ['work-205']
  }, {
    id: 'agent-ui',
    type: 'Agent',
    title: 'agent-ui',
    state: 'active',
    owner: 'system',
    source: 'agents/ui.md',
    observed: '14:02Z',
    detail: 'Renders lenses + region chrome.',
    rels: ['work-221', 'work-219']
  }, {
    id: 'agent-core',
    type: 'Agent',
    title: 'agent-core',
    state: 'warning',
    owner: 'system',
    source: 'agents/core.md',
    observed: '14:02Z',
    detail: 'Queue delay on trace validation.',
    rels: ['work-205', 'rev-08']
  }, {
    id: 'mile-03',
    type: 'Milestone',
    title: 'V1 localhost cockpit',
    state: 'verified',
    owner: 'founder',
    source: 'docs/strategy/ROADMAP.md',
    observed: '12:10Z',
    detail: 'Accepted 2026-06-21.',
    rels: ['init-009']
  }];
  const traces = [{
    status: 'ok',
    label: 'Audit passed',
    detail: 'src/regions/inspector.tsx',
    ts: '14:02:09Z'
  }, {
    status: 'active',
    label: 'Deploy running',
    detail: 'init-014 · step 4/7',
    ts: '14:02:11Z'
  }, {
    status: 'warn',
    label: 'Queue delay',
    detail: 'agent-core · routing',
    ts: '14:02:03Z'
  }, {
    status: 'error',
    label: 'Validation failed',
    detail: 'DF-LIVE-ROLLBACK-001',
    ts: '14:01:55Z'
  }, {
    status: 'ok',
    label: 'Check passed',
    detail: 'tokens/typography.css',
    ts: '14:01:30Z'
  }, {
    status: 'muted',
    label: 'Awaiting input',
    detail: 'appr-07 · founder',
    ts: '14:01:12Z'
  }, {
    status: 'ok',
    label: 'Parsed governance',
    detail: 'docs/strategy/ROADMAP.md',
    ts: '14:00:58Z'
  }];

  // topology nodes positioned on a normalized 0..100 grid
  const topology = {
    nodes: [{
      id: 'init-009',
      x: 18,
      y: 24,
      state: 'live'
    }, {
      id: 'init-014',
      x: 50,
      y: 16,
      state: 'active'
    }, {
      id: 'work-221',
      x: 76,
      y: 30,
      state: 'active'
    }, {
      id: 'work-205',
      x: 30,
      y: 58,
      state: 'blocked'
    }, {
      id: 'rev-08',
      x: 54,
      y: 72,
      state: 'failed'
    }, {
      id: 'agent-core',
      x: 78,
      y: 64,
      state: 'warning'
    }, {
      id: 'mile-03',
      x: 16,
      y: 80,
      state: 'verified'
    }],
    edges: [['init-009', 'init-014'], ['init-014', 'work-221'], ['init-009', 'work-205'], ['work-205', 'rev-08'], ['rev-08', 'agent-core'], ['init-009', 'mile-03'], ['work-221', 'agent-core']]
  };
  return {
    objects,
    traces,
    topology,
    byId: Object.fromEntries(objects.map(o => [o.id, o]))
  };
}();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/command-center/data.js", error: String((e && e.message) || e) }); }

// ui_kits/command-center/lenses.jsx
try { (() => {
/* Dreamfeed Command Center — View Registry lenses over the same object model. */
(function () {
  const DS = window.DreamfeedDesignSystem_7401df;
  const {
    Panel,
    StatePill,
    Badge,
    KeyValue,
    Button
  } = DS;
  const Icon = window.CCIcon;
  const stateColor = window.ccStateColor;

  /* ---------------- Dashboard lens ---------------- */
  function DashboardLens({
    objects,
    onSelect
  }) {
    const blockers = objects.filter(o => o.state === 'blocked' || o.state === 'failed');
    const active = objects.filter(o => o.state === 'active');
    const live = objects.filter(o => o.state === 'live' || o.state === 'verified');
    const Stat = ({
      n,
      label,
      accent
    }) => /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        padding: '12px 14px',
        background: 'var(--surface-panel)',
        border: 'var(--border-default)',
        borderRadius: 'var(--radius-2)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 28,
        fontWeight: 600,
        color: accent || 'var(--text-primary)',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1
      }
    }, String(n).padStart(2, '0')), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        marginTop: 6
      }
    }, label));
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        height: '100%',
        overflow: 'auto',
        boxSizing: 'border-box'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Stat, {
      n: live.length,
      label: "Live / verified",
      accent: "var(--df-green)"
    }), /*#__PURE__*/React.createElement(Stat, {
      n: active.length,
      label: "Active execution",
      accent: "var(--df-amber)"
    }), /*#__PURE__*/React.createElement(Stat, {
      n: blockers.length,
      label: "Blocked / failed",
      accent: "var(--df-red)"
    }), /*#__PURE__*/React.createElement(Stat, {
      n: objects.length,
      label: "Tracked objects"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        flex: 1,
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement(Panel, {
      surface: "panel",
      title: "Blockers",
      meta: blockers.length + ' requiring intervention',
      padded: false
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '4px 0'
      }
    }, blockers.map(o => /*#__PURE__*/React.createElement("button", {
      key: o.id,
      onClick: () => onSelect(o.id),
      style: objRow
    }, /*#__PURE__*/React.createElement(StatePill, {
      state: o.state
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        color: 'var(--text-primary)',
        flex: 1,
        textAlign: 'left',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, o.title), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-muted)'
      }
    }, o.id))))), /*#__PURE__*/React.createElement(Panel, {
      surface: "panel",
      title: "Active execution",
      meta: "live telemetry",
      padded: false
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '4px 0'
      }
    }, active.map(o => /*#__PURE__*/React.createElement("button", {
      key: o.id,
      onClick: () => onSelect(o.id),
      style: objRow
    }, /*#__PURE__*/React.createElement(StatePill, {
      state: o.state,
      timestamp: o.observed
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        color: 'var(--text-primary)',
        flex: 1,
        textAlign: 'left',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, o.title), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-muted)'
      }
    }, o.owner)))))));
  }
  const objRow = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    height: 32,
    padding: '0 12px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer'
  };

  /* ---------------- Topology / Graph lens ---------------- */
  function TopologyLens({
    topology,
    selectedId,
    onSelect
  }) {
    const pos = Object.fromEntries(topology.nodes.map(n => [n.id, n]));
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        background: 'var(--surface-canvas)',
        backgroundImage: 'linear-gradient(var(--df-line) 1px, transparent 1px), linear-gradient(90deg, var(--df-line) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        backgroundPosition: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 12,
        left: 14,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-muted)'
      }
    }, "topology \xB7 7 nodes \xB7 7 edges"), /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 100 100",
      preserveAspectRatio: "none",
      style: {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%'
      }
    }, topology.edges.map(([a, b], i) => /*#__PURE__*/React.createElement("line", {
      key: i,
      x1: pos[a].x,
      y1: pos[a].y,
      x2: pos[b].x,
      y2: pos[b].y,
      stroke: "var(--df-line)",
      strokeWidth: "1.4",
      vectorEffect: "non-scaling-stroke"
    }))), topology.nodes.map(n => {
      const on = selectedId === n.id;
      return /*#__PURE__*/React.createElement("button", {
        key: n.id,
        onClick: () => onSelect(n.id),
        title: n.id,
        style: {
          position: 'absolute',
          left: n.x + '%',
          top: n.y + '%',
          transform: 'translate(-50%,-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 5,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          padding: 0
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          width: on ? 18 : 14,
          height: on ? 18 : 14,
          borderRadius: '50%',
          background: stateColor(n.state),
          boxShadow: on ? '0 0 0 4px var(--df-bg-canvas), 0 0 0 5px var(--df-amber)' : '0 0 0 3px var(--df-bg-canvas)',
          transition: 'all 120ms var(--ease-crisp)'
        }
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
          background: 'var(--surface-canvas)',
          padding: '0 3px'
        }
      }, n.id));
    }));
  }

  /* ---------------- IDE lens ---------------- */
  const FILES = [{
    name: 'tools/command-center/',
    dir: true
  }, {
    name: '  src/regions/inspector.tsx',
    state: 'verified'
  }, {
    name: '  src/regions/bottom.tsx',
    state: 'blocked'
  }, {
    name: '  src/lenses/topology.tsx',
    state: 'active'
  }, {
    name: '  tokens/typography.css',
    state: 'verified'
  }, {
    name: '  schema/trace.json',
    state: 'failed'
  }];
  function IdeLens({
    onSelect
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        height: '100%',
        background: 'var(--surface-canvas)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 230,
        flex: '0 0 auto',
        borderRight: 'var(--border-default)',
        padding: '8px 0',
        overflow: 'auto'
      }
    }, FILES.map((f, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 24,
        padding: '0 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: f.dir ? 'var(--text-muted)' : 'var(--text-secondary)',
        whiteSpace: 'pre',
        cursor: f.dir ? 'default' : 'pointer'
      }
    }, !f.dir && /*#__PURE__*/React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: stateColor(f.state),
        flex: '0 0 auto'
      }
    }), f.dir && /*#__PURE__*/React.createElement(Icon, {
      name: "folder-git-2",
      size: 13
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, f.name.trim())))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        borderBottom: 'var(--border-default)',
        background: 'var(--surface-panel)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'var(--text-primary)'
      }
    }, "schema/trace.json"), /*#__PURE__*/React.createElement(StatePill, {
      state: "failed"
    })), /*#__PURE__*/React.createElement("pre", {
      style: {
        margin: 0,
        padding: 14,
        flex: 1,
        overflow: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 12.5,
        lineHeight: 1.55,
        color: 'var(--text-secondary)',
        fontFeatureSettings: "'zero' 1, 'ss01' 1"
      }
    }, `{
  "trace": "DF-LIVE-ROLLBACK-001",
  "step": 4,`, /*#__PURE__*/React.createElement("span", {
      style: {
        background: 'var(--df-red-dim)',
        display: 'block',
        margin: '0 -14px',
        padding: '0 14px',
        color: 'var(--df-red)'
      }
    }, `-  "affected": null,            // validation failed`), /*#__PURE__*/React.createElement("span", {
      style: {
        background: 'var(--df-green-dim)',
        display: 'block',
        margin: '0 -14px',
        padding: '0 14px',
        color: 'var(--df-green)'
      }
    }, `+  "affectedStep": "deploy/init-014",`), `  "prior": "queued",
  "result": "active",
  "ts": "2026-06-21T14:02:11Z"
}`)));
  }

  /* ---------------- Table lens ---------------- */
  function TableLens({
    objects,
    selectedId,
    onSelect
  }) {
    const cols = ['State', 'ID', 'Type', 'Title', 'Owner', 'Source', 'Observed'];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        height: '100%',
        overflow: 'auto',
        background: 'var(--surface-canvas)'
      }
    }, /*#__PURE__*/React.createElement("table", {
      style: {
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: 'var(--font-mono)',
        fontSize: 12
      }
    }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, cols.map(c => /*#__PURE__*/React.createElement("th", {
      key: c,
      style: {
        position: 'sticky',
        top: 0,
        textAlign: 'left',
        padding: '8px 12px',
        background: 'var(--surface-raised)',
        borderBottom: 'var(--border-default)',
        fontFamily: 'var(--font-sans)',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        whiteSpace: 'nowrap'
      }
    }, c)))), /*#__PURE__*/React.createElement("tbody", null, objects.map(o => {
      const on = selectedId === o.id;
      return /*#__PURE__*/React.createElement("tr", {
        key: o.id,
        onClick: () => onSelect(o.id),
        style: {
          cursor: 'pointer',
          background: on ? 'var(--df-panel)' : 'transparent',
          borderLeft: on ? '2px solid var(--df-amber)' : '2px solid transparent'
        }
      }, /*#__PURE__*/React.createElement("td", {
        style: td
      }, /*#__PURE__*/React.createElement(StatePill, {
        state: o.state
      })), /*#__PURE__*/React.createElement("td", {
        style: {
          ...td,
          color: 'var(--text-primary)'
        }
      }, o.id), /*#__PURE__*/React.createElement("td", {
        style: {
          ...td,
          fontFamily: 'var(--font-sans)',
          color: 'var(--text-secondary)'
        }
      }, o.type), /*#__PURE__*/React.createElement("td", {
        style: {
          ...td,
          fontFamily: 'var(--font-sans)',
          color: 'var(--text-primary)',
          maxWidth: 240,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }
      }, o.title), /*#__PURE__*/React.createElement("td", {
        style: {
          ...td,
          color: 'var(--text-muted)'
        }
      }, o.owner), /*#__PURE__*/React.createElement("td", {
        style: {
          ...td,
          color: 'var(--text-muted)',
          maxWidth: 200,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }
      }, o.source), /*#__PURE__*/React.createElement("td", {
        style: {
          ...td,
          color: 'var(--text-muted)',
          fontVariantNumeric: 'tabular-nums'
        }
      }, o.observed));
    }))));
  }
  const td = {
    padding: '6px 12px',
    borderBottom: 'var(--border-default)',
    whiteSpace: 'nowrap'
  };
  Object.assign(window, {
    CCDashboardLens: DashboardLens,
    CCTopologyLens: TopologyLens,
    CCIdeLens: IdeLens,
    CCTableLens: TableLens
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/command-center/lenses.jsx", error: String((e && e.message) || e) }); }

// ui_kits/command-center/regions.jsx
try { (() => {
/* Dreamfeed Command Center — the five persistent regions.
   Composes design-system primitives from window.DreamfeedDesignSystem_7401df. */
(function () {
  const DS = window.DreamfeedDesignSystem_7401df;
  const {
    Panel,
    IconButton,
    Button,
    StatePill,
    KeyValue,
    Badge,
    TextField,
    Switch,
    Tabs,
    TraceRow
  } = DS;
  function Icon({
    name,
    size = 16
  }) {
    return /*#__PURE__*/React.createElement("i", {
      "data-lucide": name,
      style: {
        display: 'inline-flex',
        width: size,
        height: size
      }
    });
  }

  /* ---------------- Left sidebar (--df-panel) ---------------- */
  const NAV = [{
    id: 'overview',
    icon: 'layout-dashboard',
    label: 'Overview'
  }, {
    id: 'initiatives',
    icon: 'target',
    label: 'Initiatives',
    count: 2
  }, {
    id: 'work',
    icon: 'list-checks',
    label: 'Work items',
    count: 4
  }, {
    id: 'agents',
    icon: 'bot',
    label: 'Agents',
    count: 2
  }, {
    id: 'sources',
    icon: 'folder-git-2',
    label: 'Source files'
  }];
  function Sidebar({
    active,
    onNav,
    pinned,
    onSelect,
    selectedId
  }) {
    return /*#__PURE__*/React.createElement("aside", {
      style: {
        width: 'var(--region-sidebar-w)',
        flex: '0 0 auto',
        background: 'var(--surface-panel)',
        borderRight: 'var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: 'var(--region-commandbar-h)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
        borderBottom: 'var(--border-default)'
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/logo-mark.svg",
      width: "22",
      height: "22",
      alt: ""
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: '0.01em',
        color: 'var(--text-primary)'
      }
    }, "Dreamfeed")), /*#__PURE__*/React.createElement("nav", {
      style: {
        padding: '10px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '4px 8px 6px',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)'
      }
    }, "Work modes"), NAV.map(n => {
      const on = active === n.id;
      return /*#__PURE__*/React.createElement("button", {
        key: n.id,
        onClick: () => onNav(n.id),
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: 30,
          padding: '0 8px',
          border: 'none',
          borderRadius: 'var(--radius-1)',
          cursor: 'pointer',
          background: on ? 'var(--df-panel-raised)' : 'transparent',
          color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          fontWeight: on ? 600 : 400,
          textAlign: 'left'
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: n.icon,
        size: 15
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          flex: 1
        }
      }, n.label), n.count != null && /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-muted)'
        }
      }, n.count));
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '6px 8px',
        borderTop: 'var(--border-default)',
        marginTop: 4,
        flex: 1,
        minHeight: 0,
        overflow: 'auto'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '4px 8px 6px',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)'
      }
    }, "Pinned context"), pinned.map(o => {
      const on = selectedId === o.id;
      return /*#__PURE__*/React.createElement("button", {
        key: o.id,
        onClick: () => onSelect(o.id),
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          height: 28,
          padding: '0 8px',
          border: 'none',
          borderLeft: `2px solid ${on ? 'var(--df-amber)' : 'transparent'}`,
          cursor: 'pointer',
          background: on ? 'var(--df-panel)' : 'transparent',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          textAlign: 'left'
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          width: 6,
          height: 6,
          borderRadius: '50%',
          flex: '0 0 auto',
          background: stateColor(o.state)
        }
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: on ? 'var(--text-primary)' : 'var(--text-secondary)'
        }
      }, o.id));
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '8px 14px',
        borderTop: 'var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(StatePill, {
      state: "live",
      label: "V1 LIVE"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--text-muted)'
      }
    }, "localhost")));
  }

  /* ---------------- Top command bar (--df-panel-raised) ---------------- */
  function CommandBar({
    live,
    onLive,
    density,
    onDensity
  }) {
    return /*#__PURE__*/React.createElement("header", {
      style: {
        height: 'var(--region-commandbar-h)',
        flex: '0 0 auto',
        background: 'var(--surface-raised)',
        borderBottom: 'var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 12px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: 360,
        maxWidth: '40%'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flex: 1,
        height: 28,
        padding: '0 10px',
        background: 'var(--surface-sunken)',
        border: 'var(--border-default)',
        borderRadius: 'var(--radius-1)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "search",
      size: 14
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'var(--text-muted)'
      }
    }, "command or object\u2026"), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-muted)',
        border: 'var(--border-default)',
        borderRadius: 2,
        padding: '0 4px'
      }
    }, "\u2318K"))), /*#__PURE__*/React.createElement(Badge, {
      mono: true
    }, "main"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'var(--text-muted)'
      }
    }, "parsed 14:02:09Z"), /*#__PURE__*/React.createElement("div", {
      style: {
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(Switch, {
      checked: live,
      onChange: onLive,
      label: "Live"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 2
      }
    }, /*#__PURE__*/React.createElement(IconButton, {
      label: "Compact density",
      active: density === 'compact',
      onClick: () => onDensity('compact')
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "rows-3",
      size: 15
    })), /*#__PURE__*/React.createElement(IconButton, {
      label: "Cozy density",
      active: density === 'cozy',
      onClick: () => onDensity('cozy')
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "rows-2",
      size: 15
    }))), /*#__PURE__*/React.createElement(IconButton, {
      label: "Keyboard"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "keyboard",
      size: 15
    }))));
  }

  /* ---------------- Right inspector (--df-panel) ---------------- */
  function Inspector({
    obj,
    onSelect
  }) {
    if (!obj) {
      return /*#__PURE__*/React.createElement("aside", {
        style: inspectorShell
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          padding: 16,
          color: 'var(--text-muted)',
          fontSize: 12,
          fontFamily: 'var(--font-mono)'
        }
      }, "No object selected. Select a node, row, or trace."));
    }
    const rels = (obj.rels || []).map(id => window.CC_DATA.byId[id]).filter(Boolean);
    return /*#__PURE__*/React.createElement("aside", {
      style: inspectorShell
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '12px 14px',
        borderBottom: 'var(--border-default)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        marginBottom: 6
      }
    }, obj.type), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 600,
        color: 'var(--text-primary)',
        lineHeight: 1.3
      }
    }, obj.title)), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8
      }
    }, /*#__PURE__*/React.createElement(StatePill, {
      state: obj.state,
      timestamp: obj.observed
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '6px 14px',
        flex: 1,
        minHeight: 0,
        overflow: 'auto'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
        padding: '8px 0 10px'
      }
    }, obj.detail), /*#__PURE__*/React.createElement(KeyValue, {
      label: "Object ID",
      value: obj.id
    }), /*#__PURE__*/React.createElement(KeyValue, {
      label: "Owner",
      value: obj.owner
    }), /*#__PURE__*/React.createElement(KeyValue, {
      label: "Source",
      value: obj.source
    }), /*#__PURE__*/React.createElement(KeyValue, {
      label: "Last observed",
      value: obj.observed,
      accent: "amber"
    }), rels.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        marginBottom: 6
      }
    }, "Relationships"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }
    }, rels.map(r => /*#__PURE__*/React.createElement("button", {
      key: r.id,
      onClick: () => onSelect(r.id),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 26,
        padding: '0 8px',
        border: 'var(--border-default)',
        borderRadius: 'var(--radius-1)',
        background: 'var(--surface-sunken)',
        cursor: 'pointer',
        textAlign: 'left'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: '50%',
        flex: '0 0 auto',
        background: stateColor(r.state)
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 11.5,
        color: 'var(--text-primary)'
      }
    }, r.id), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-sans)',
        fontSize: 11.5,
        color: 'var(--text-muted)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, r.type)))))), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: 12,
        borderTop: 'var(--border-default)',
        background: 'var(--surface-raised)',
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "md",
      style: {
        flex: 1
      }
    }, "Inspect source"), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "md"
    }, "Trace")));
  }
  const inspectorShell = {
    width: 'var(--region-inspector-w)',
    flex: '0 0 auto',
    background: 'var(--surface-panel)',
    borderLeft: 'var(--border-default)',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0
  };

  /* ---------------- Bottom panel (--df-panel-raised) ---------------- */
  function BottomPanel({
    traces,
    onSelectTrace,
    selectedTrace
  }) {
    const [tab, setTab] = React.useState('traces');
    const counts = {
      ok: 0,
      error: 0
    };
    traces.forEach(t => {
      if (t.status === 'ok') counts.ok++;
      if (t.status === 'error') counts.error++;
    });
    return /*#__PURE__*/React.createElement("section", {
      style: {
        height: 'var(--region-bottompanel-h)',
        flex: '0 0 auto',
        background: 'var(--surface-raised)',
        borderTop: 'var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        borderBottom: 'var(--border-default)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(Tabs, {
      value: tab,
      onChange: setTab,
      tabs: [{
        value: 'traces',
        label: 'Execution Trace Map',
        count: traces.length
      }, {
        value: 'validation',
        label: 'Validation',
        count: counts.error
      }, {
        value: 'logs',
        label: 'Command output'
      }]
    })), /*#__PURE__*/React.createElement(Badge, {
      tone: "info",
      style: {
        marginRight: 8
      }
    }, "read-only \xB7 V1")), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: '4px 0'
      }
    }, tab !== 'logs' ? traces.filter(t => tab === 'traces' || t.status === 'error' || t.status === 'warn').map((t, i) => /*#__PURE__*/React.createElement(TraceRow, {
      key: i,
      status: t.status,
      label: t.label,
      detail: t.detail,
      timestamp: t.ts,
      selected: selectedTrace === i,
      onClick: () => onSelectTrace(i)
    })) : /*#__PURE__*/React.createElement("pre", {
      style: {
        margin: 0,
        padding: '8px 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        lineHeight: 1.5,
        color: 'var(--text-secondary)'
      }
    }, `$ df parse docs/strategy/ROADMAP.md
  parsed 11 governance objects · 7 edges
  topology rebuilt in 38ms
$ df audit --read-only
  4 passed · 1 failed · 1 blocked`)), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '6px 12px',
        borderTop: 'var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(StatePill, {
      state: "passed",
      label: counts.ok + ' PASSED'
    }), /*#__PURE__*/React.createElement(StatePill, {
      state: "failed",
      label: counts.error + ' FAILED'
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-muted)'
      }
    }, "Surgical Overrides unlock in execution-enabled phase")));
  }
  function stateColor(s) {
    return {
      live: 'var(--df-green)',
      verified: 'var(--df-green)',
      passed: 'var(--df-green)',
      accepted: 'var(--df-green)',
      active: 'var(--df-amber)',
      queued: 'var(--df-amber)',
      warning: 'var(--df-amber)',
      blocked: 'var(--df-red)',
      failed: 'var(--df-red)',
      pending: 'var(--df-cyan)'
    }[s] || 'var(--text-muted)';
  }
  Object.assign(window, {
    CCSidebar: Sidebar,
    CCCommandBar: CommandBar,
    CCInspector: Inspector,
    CCBottomPanel: BottomPanel,
    CCIcon: Icon,
    ccStateColor: stateColor
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/command-center/regions.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Panel = __ds_scope.Panel;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.TextField = __ds_scope.TextField;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.KeyValue = __ds_scope.KeyValue;

__ds_ns.StatePill = __ds_scope.StatePill;

__ds_ns.TraceRow = __ds_scope.TraceRow;

})();
