import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { FieldDescriptor } from '@kn/core';
import { Glyph } from '../ui/Glyph.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { visibleFields } from './form-state.ts';
import { AssetControl } from './controls/AssetControl.tsx';
import { ColorControl } from './controls/ColorControl.tsx';
import { MultiSelectControl } from './controls/MultiSelectControl.tsx';
import { NumberControl } from './controls/NumberControl.tsx';
import { NumberListControl } from './controls/NumberListControl.tsx';
import { SelectControl } from './controls/SelectControl.tsx';
import { StringListControl } from './controls/StringListControl.tsx';
import { TextControl } from './controls/TextControl.tsx';
import { ToggleControl } from './controls/ToggleControl.tsx';

export interface SchemaFormProps {
  fields: readonly FieldDescriptor[];
  draft: Readonly<Record<string, unknown>>;
  errors: Readonly<Record<string, string[]>>;
  onChange(key: string, value: unknown): void;
}

function renderControl(
  field: FieldDescriptor,
  value: unknown,
  errors: string[],
  onChange: (v: unknown) => void,
): ReactNode {
  const p = { value, errors, onChange };
  switch (field.type) {
    case 'text':
    case 'multiline':
      return <TextControl field={field} {...p} />;
    case 'number':
      return <NumberControl field={field} {...p} />;
    case 'toggle':
      return <ToggleControl field={field} {...p} />;
    case 'select':
      return <SelectControl field={field} {...p} />;
    case 'multi-select':
      return <MultiSelectControl field={field} {...p} />;
    case 'color':
      return <ColorControl field={field} {...p} />;
    case 'string-list':
      return <StringListControl field={field} {...p} />;
    case 'number-list':
      return <NumberListControl field={field} {...p} />;
    case 'asset':
      return <AssetControl field={field} {...p} />;
    default: {
      const unreachable: never = field;
      return unreachable;
    }
  }
}

export function SchemaForm({ fields, draft, errors, onChange }: SchemaFormProps): ReactNode {
  // The Sheet body already spaces its children; fields are separated by the same 24dp here.
  return (
    <View style={{ gap: space.xl }}>
      {visibleFields(fields, draft).map((field) => {
        const fieldErrors = errors[field.key] ?? [];
        // Toggles draw their own label row (label left, switch right).
        const chrome = field.type !== 'toggle';
        return (
          <View key={field.key} style={{ gap: space.xs }} testID={`form-field-${field.key}`}>
            {chrome ? <Txt variant="label">{field.label}</Txt> : null}
            {chrome && field.help ? (
              <Txt variant="caption" color="inkMuted">
                {field.help}
              </Txt>
            ) : null}
            {renderControl(field, draft[field.key], fieldErrors, (v) => onChange(field.key, v))}
            {fieldErrors.map((e) => (
              <View key={e} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                <Glyph name="alert-circle" size={14} color="danger" />
                <Txt variant="caption" color="danger" style={{ flex: 1 }}>
                  {e}
                </Txt>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
