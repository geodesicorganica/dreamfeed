import * as React from 'react';

export interface SelectOption { value: string; label: string; }

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: React.ReactNode;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  /** Options as strings or {value,label} objects. */
  options?: Array<string | SelectOption>;
  size?: 'sm' | 'md' | 'lg';
}

/** Compact native dropdown styled to the panel system. */
export function Select(props: SelectProps): React.ReactElement;
