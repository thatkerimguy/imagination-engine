import type { ReactNode } from 'react';
import { Chip } from '../../ui/Chip.tsx';
import { Row } from '../../ui/layout.tsx';
import { tapFeedback } from '../../ui/haptics.ts';
import type { ControlProps } from './types.ts';

export function SelectControl({ field, value, onChange }: ControlProps<'select'>): ReactNode {
  return (
    <Row>
      {field.options.map((o) => (
        <Chip
          key={o.value}
          testID={`field-${field.key}-${o.value}`}
          label={o.label}
          selected={value === o.value}
          onPress={() => {
            tapFeedback();
            onChange(o.value);
          }}
        />
      ))}
    </Row>
  );
}
