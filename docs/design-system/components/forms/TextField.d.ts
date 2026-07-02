import * as React from 'react';

/**
 * Single-line input seated in a sunken well.
 * @startingPoint section="Forms" subtitle="Text + mono inputs, select, switch" viewport="700x150"
 */
export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  /** Structural uppercase label above the field. */
  label?: React.ReactNode;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  /** Use the monospace face for command / path / ID / schema entry. */
  mono?: boolean;
  /** Mono prefix glyph inside the well (e.g. "$", "/"). */
  prefix?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Error message text — also turns the border red. */
  error?: React.ReactNode;
}

/** Single-line input seated in a sunken well. */
export function TextField(props: TextFieldProps): React.ReactElement;
