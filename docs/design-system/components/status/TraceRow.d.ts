import * as React from 'react';

export interface TraceRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Status tick color family. */
  status?: 'ok' | 'active' | 'warn' | 'error' | 'info' | 'muted';
  /** Sans label — the affected object / event name. */
  label: React.ReactNode;
  /** Mono detail — path, ID, diagnostic, or value. */
  detail?: React.ReactNode;
  /** Mono timestamp (right-aligned). */
  timestamp?: string;
  selected?: boolean;
}

/** One row of an Execution Trace Map / log ledger. */
export function TraceRow(props: TraceRowProps): React.ReactElement;
