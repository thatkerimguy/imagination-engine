import type { ReactNode } from 'react';
import { SegmentControl } from '../../ui/SegmentControl.tsx';
import { OptionGrid } from './OptionGrid.tsx';
import type { ControlProps } from './types.ts';

/** Up to 4 short options read best as one segmented row; longer sets become a tile grid. */
export function isSegmentable(options: readonly { label: string }[]): boolean {
  const total = options.reduce((n, o) => n + o.label.length, 0);
  return options.length <= 4 && options.every((o) => o.label.length <= 12) && total <= 34;
}

export function SelectControl({ field, value, onChange }: ControlProps<'select'>): ReactNode {
  const current = typeof value === 'string' ? value : '';
  if (isSegmentable(field.options)) {
    return (
      <SegmentControl
        accessibilityLabel={field.label}
        value={current}
        onChange={onChange}
        options={field.options.map((o) => ({
          value: o.value,
          label: o.label,
          testID: `field-${field.key}-${o.value}`,
        }))}
      />
    );
  }
  return (
    <OptionGrid
      role="radio"
      options={field.options}
      isSelected={(v) => v === current}
      onPick={onChange}
      testIDFor={(v) => `field-${field.key}-${v}`}
    />
  );
}
