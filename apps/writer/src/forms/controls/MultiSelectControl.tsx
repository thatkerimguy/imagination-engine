import type { ReactNode } from 'react';
import { Chip } from '../../ui/Chip.tsx';
import { Row } from '../../ui/layout.tsx';
import { tapFeedback } from '../../ui/haptics.ts';
import { asStringArray } from '../form-state.ts';
import type { ControlProps } from './types.ts';

export function MultiSelectControl({
  field,
  value,
  onChange,
}: ControlProps<'multi-select'>): ReactNode {
  const selected = asStringArray(value);
  const full = field.maxItems !== undefined && selected.length >= field.maxItems;
  const toggle = (v: string): void => {
    tapFeedback();
    if (selected.includes(v)) {
      onChange(selected.filter((x) => x !== v));
    } else if (!full) {
      // Keep the schema's option order so the stored list is stable.
      onChange(field.options.map((o) => o.value).filter((x) => x === v || selected.includes(x)));
    }
  };
  return (
    <Row>
      {field.options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <Chip
            key={o.value}
            testID={`field-${field.key}-${o.value}`}
            label={o.label}
            selected={on}
            onPress={on || !full ? () => toggle(o.value) : undefined}
          />
        );
      })}
    </Row>
  );
}
