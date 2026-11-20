import type { ReactNode } from 'react';
import { asStringArray } from '../form-state.ts';
import { OptionGrid } from './OptionGrid.tsx';
import type { ControlProps } from './types.ts';

export function MultiSelectControl({
  field,
  value,
  onChange,
}: ControlProps<'multi-select'>): ReactNode {
  const selected = asStringArray(value);
  const full = field.maxItems !== undefined && selected.length >= field.maxItems;
  const toggle = (v: string): void => {
    if (selected.includes(v)) {
      onChange(selected.filter((x) => x !== v));
    } else if (!full) {
      // Keep the schema's option order so the stored list is stable.
      onChange(field.options.map((o) => o.value).filter((x) => x === v || selected.includes(x)));
    }
  };
  return (
    <OptionGrid
      role="checkbox"
      options={field.options}
      isSelected={(v) => selected.includes(v)}
      isDisabled={() => full}
      onPick={toggle}
      testIDFor={(v) => `field-${field.key}-${v}`}
    />
  );
}
