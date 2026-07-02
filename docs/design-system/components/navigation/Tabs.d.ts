import * as React from 'react';

export interface TabItem {
  value: string;
  label: React.ReactNode;
  /** Optional leading icon node. */
  icon?: React.ReactNode;
  /** Optional mono count shown after the label. */
  count?: number | string;
}

/**
 * View Registry lens switcher / segmented control. Active lens = underline tick.
 * @startingPoint section="Navigation" subtitle="Lens switcher / segmented tabs" viewport="700x120"
 */
export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Tabs as strings or {value,label,icon,count}. */
  tabs?: Array<string | TabItem>;
  value?: string;
  onChange?: (value: string) => void;
}

/** View Registry lens switcher / segmented control. */
export function Tabs(props: TabsProps): React.ReactElement;
