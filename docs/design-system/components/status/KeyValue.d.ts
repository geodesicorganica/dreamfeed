import * as React from 'react';

export interface KeyValueProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Sans label (left). */
  label: React.ReactNode;
  /** Value (right). Pass via prop or as children. */
  value?: React.ReactNode;
  /** Render value in monospace (default true). */
  mono?: boolean;
  align?: 'split' | 'left';
  /** Tint the value with a state color: 'green' | 'amber' | 'red' | 'cyan'. */
  accent?: 'green' | 'amber' | 'red' | 'cyan' | null;
  children?: React.ReactNode;
}

/** A provenance / inspector detail row (sans label + mono value). */
export function KeyValue(props: KeyValueProps): React.ReactElement;
