import * as React from 'react';

export interface SwitchProps {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  /** Optional text label reinforcing the state. */
  label?: React.ReactNode;
  id?: string;
  style?: React.CSSProperties;
}

/** Binary mode toggle — state shown by knob position, not color alone. */
export function Switch(props: SwitchProps): React.ReactElement;
