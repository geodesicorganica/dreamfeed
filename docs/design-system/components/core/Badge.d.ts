import * as React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Optional functional-state tint. Badge must still carry legible text. */
  tone?: 'neutral' | 'info' | 'ok' | 'warn' | 'error';
  /** Use the monospace face for IDs / counts / versions. */
  mono?: boolean;
  children?: React.ReactNode;
}

/** Small count / label chip. */
export function Badge(props: BadgeProps): React.ReactElement;
