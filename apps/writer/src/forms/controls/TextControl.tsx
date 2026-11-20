import type { ReactNode } from 'react';
import { Field } from '../../ui/Field.tsx';
import { asString } from '../form-state.ts';
import type { ControlProps } from './types.ts';

export function TextControl({
  field,
  value,
  onChange,
  errors,
}: ControlProps<'text' | 'multiline'>): ReactNode {
  const text = asString(value);
  return (
    <Field
      testID={`field-${field.key}`}
      accessibilityLabel={field.label}
      value={text}
      onChangeText={onChange}
      placeholder={field.placeholder}
      multiline={field.type === 'multiline'}
      error={errors.length > 0 ? ' ' : null}
      trailingHint={field.maxLength !== undefined ? `${text.length}/${field.maxLength}` : undefined}
    />
  );
}
