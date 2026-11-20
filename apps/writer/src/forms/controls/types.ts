import type { FieldDescriptor, FieldType } from '@kn/core';

/** Props every control receives; `value` is untrusted and narrowed inside each control. */
export interface ControlProps<T extends FieldType> {
  field: Extract<FieldDescriptor, { type: T }>;
  value: unknown;
  onChange(value: unknown): void;
  errors: string[];
}
