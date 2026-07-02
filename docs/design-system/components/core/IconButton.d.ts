import * as React from 'react';

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  size?: 'sm' | 'md' | 'lg';
  /** Mark a held mode — selected lens, pinned object, active filter. */
  active?: boolean;
  disabled?: boolean;
  /** Accessible label (also used as the tooltip title). Required. */
  label: string;
  children?: React.ReactNode;
}

/** Square icon-only control for command-bar and region chrome. */
export function IconButton(props: IconButtonProps): React.ReactElement;
