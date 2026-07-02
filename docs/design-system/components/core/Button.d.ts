import * as React from 'react';

/**
 * Neutral industrial command button. Even `primary` stays neutral; only
 * `danger` carries Off-Nominal Red, for destructive actions.
 * @startingPoint section="Core" subtitle="Command buttons — primary, secondary, ghost, danger" viewport="700x150"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual emphasis. `primary` is a neutral raised fill (color is reserved for state). */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  /** Optional leading icon node (e.g. a Lucide <i data-lucide>). */
  iconLeft?: React.ReactNode;
  /** Optional trailing icon node. */
  iconRight?: React.ReactNode;
  children?: React.ReactNode;
}

/** Neutral industrial command button. */
export function Button(props: ButtonProps): React.ReactElement;
