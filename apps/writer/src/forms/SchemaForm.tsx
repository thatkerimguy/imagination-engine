import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { FieldDescriptor } from '@kn/core';
import { colors, space } from '../ui/theme.ts';
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
  return (
    <View style={styles.form}>
      {visibleFields(fields, draft).map((field) => {
        const fieldErrors = errors[field.key] ?? [];
        return (
          <View key={field.key} style={styles.field} testID={`form-field-${field.key}`}>
            <Text style={styles.label}>{field.label}</Text>
            {field.help ? <Text style={styles.help}>{field.help}</Text> : null}
            {renderControl(field, draft[field.key], fieldErrors, (v) => onChange(field.key, v))}
            {fieldErrors.map((e) => (
              <Text key={e} style={styles.error}>
                {e}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  field: { gap: space.sm },
  label: { color: colors.fg, fontSize: 14, fontWeight: '600' },
  help: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger, fontSize: 12, fontWeight: '600' },
});
