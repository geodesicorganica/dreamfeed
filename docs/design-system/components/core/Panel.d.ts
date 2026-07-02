import * as React from 'react';

/**
 * A depth-plane surface for the five persistent Command Center regions.
 * @startingPoint section="Core" subtitle="Region surface with overline header" viewport="700x150"
 */
export interface PanelProps extends React.HTMLAttributes<HTMLElement> {
  /** Depth plane. A `raised` panel signals an active command/inspection/trace context. */
  surface?: 'canvas' | 'panel' | 'raised' | 'sunken';
  /** Region header overline label. Pass null for a headerless surface. */
  title?: React.ReactNode;
  /** Mono meta string shown beside the title (count, timestamp, ID). */
  meta?: React.ReactNode;
  /** Header action nodes (IconButtons, etc). */
  actions?: React.ReactNode;
  padded?: boolean;
  bordered?: boolean;
  bodyStyle?: React.CSSProperties;
  children?: React.ReactNode;
}

/** A depth-plane surface for the five persistent Command Center regions. */
export function Panel(props: PanelProps): React.ReactElement;
