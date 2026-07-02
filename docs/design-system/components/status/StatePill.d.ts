import * as React from 'react';

export type OperationalState =
  // Green — verified / passed / live record states
  | 'live' | 'verified' | 'passed' | 'accepted' | 'buildok'
  // Amber — active process / warning / queue delay
  | 'active' | 'running' | 'queued' | 'warning'
  // Red — halt / failure / blockage
  | 'halted' | 'blocked' | 'failed'
  // Cyan — selection / focus / informational
  | 'selected' | 'info' | 'pending'
  // Neutral — nominal / silent
  | 'idle' | 'locked' | 'archived' | 'stale';

/**
 * Canonical operational state indicator: colored dot + explicit text label
 * (+ optional timestamp). Color is never the only signal.
 * @startingPoint section="Status" subtitle="Operational state indicators with text + timestamp" viewport="700x150"
 */
export interface StatePillProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Operational state — sets dot color and default text label. */
  state?: OperationalState;
  /** Override the default uppercase label text. */
  label?: string;
  /** Optional freshness timestamp (mono, tabular). */
  timestamp?: string;
  /** Filled tint background instead of outline. */
  filled?: boolean;
}

/** Canonical operational state indicator: colored dot + text label + optional timestamp. */
export function StatePill(props: StatePillProps): React.ReactElement;
