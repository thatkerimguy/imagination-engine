// List (string rows) and records (object rows) controls: add, remove and reorder.
import type { BlueprintRecord, RecordColumn, BlueprintFieldSpec } from '@kn/core/gimmicks';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Field } from '../ui/Field.tsx';
import { IconBtn } from '../ui/IconBtn.tsx';
import { SegmentControl } from '../ui/SegmentControl.tsx';
import { Stepper } from '../ui/Stepper.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { tapFeedback } from '../ui/haptics.ts';
import {
  blankRecord,
  listOf,
  moveAt,
  numberOf,
  recordsOf,
  removeAt,
  replaceAt,
  setCell,
  textOf,
} from './form-model.ts';
import { OptionGrid } from '../forms/controls/OptionGrid.tsx';

type ListSpec = Extract<BlueprintFieldSpec, { type: 'list' }>;
type RecordsSpec = Extract<BlueprintFieldSpec, { type: 'records' }>;

function RowHead(p: {
  item: string;
  n: number;
  count: number;
  min: number;
  onMove(d: 1 | -1): void;
  onRemove(): void;
}): ReactNode {
  const { t } = useI18n();
  const vars = { item: p.item, n: p.n + 1 };
  return (
    <View style={styles.head}>
      <Txt
        variant="overline"
        color="inkMuted"
        style={styles.grow}
        numberOfLines={1}
      >{`${p.item} ${p.n + 1}`}</Txt>
      <IconBtn
        icon="arrow-up"
        box={32}
        size={16}
        accessibilityLabel={t('form.moveUp', vars)}
        disabled={p.n === 0}
        onPress={() => p.onMove(-1)}
      />
      <IconBtn
        icon="arrow-down"
        box={32}
        size={16}
        accessibilityLabel={t('form.moveDown', vars)}
        disabled={p.n === p.count - 1}
        onPress={() => p.onMove(1)}
      />
      <IconBtn
        icon="x"
        box={32}
        size={16}
        accessibilityLabel={t('form.remove', vars)}
        disabled={p.count <= p.min}
        onPress={p.onRemove}
      />
    </View>
  );
}

export function ListField(p: {
  field: ListSpec;
  value: unknown;
  invalid: boolean;
  onChange(v: string[]): void;
}): ReactNode {
  const { t } = useI18n();
  const { field } = p;
  const items = listOf(p.value);
  const item = field.itemLabel ?? t('form.item');
  const min = field.minItems ?? 0;
  const act = (fn: () => void) => (): void => {
    tapFeedback();
    fn();
  };
  return (
    <View style={styles.stack}>
      {items.map((text, i) => (
        <View key={i} style={styles.stack}>
          <RowHead
            item={item}
            n={i}
            count={items.length}
            min={min}
            onMove={(d) => p.onChange(moveAt(items, i, d))}
            onRemove={act(() => p.onChange(removeAt(items, i)))}
          />
          <Field
            dense
            multiline
            testID={`field-${field.key}-${i}`}
            accessibilityLabel={`${item} ${i + 1}`}
            value={text}
            onChangeText={(v) => p.onChange(replaceAt(items, i, v))}
            error={p.invalid && text.trim() === '' ? ' ' : null}
          />
        </View>
      ))}
      <ActionButton
        label={t('form.add', { item })}
        variant="secondary"
        compact
        icon="plus"
        disabled={field.maxItems !== undefined && items.length >= field.maxItems}
        testID={`field-${field.key}-add`}
        onPress={act(() => p.onChange([...items, '']))}
        style={styles.self}
      />
    </View>
  );
}

function Cell(p: {
  fieldKey: string;
  row: number;
  col: RecordColumn;
  value: unknown;
  onChange(v: string | number): void;
}): ReactNode {
  const { col } = p;
  const id = `field-${p.fieldKey}-${p.row}-${col.key}`;
  if (col.type === 'number')
    return (
      <View style={styles.self}>
        <Txt variant="caption" color="inkMuted">
          {col.label}
        </Txt>
        <Stepper
          compact
          testID={id}
          label={col.label}
          value={numberOf(p.value, 0)}
          min={-1e6}
          max={1e6}
          step={1}
          onChange={p.onChange}
        />
      </View>
    );
  if (col.type === 'select') {
    const options = col.options ?? [];
    const short = options.length <= 3 && options.every((o) => o.label.length <= 10);
    return short ? (
      <SegmentControl
        accessibilityLabel={col.label}
        value={textOf(p.value)}
        onChange={p.onChange}
        options={options.map((o) => ({
          value: o.value,
          label: o.label,
          testID: `${id}-${o.value}`,
        }))}
      />
    ) : (
      <OptionGrid
        role="radio"
        options={options}
        isSelected={(v) => v === textOf(p.value)}
        onPick={p.onChange}
        testIDFor={(v) => `${id}-${v}`}
      />
    );
  }
  return (
    <Field
      dense
      multiline
      label={col.label}
      testID={id}
      accessibilityLabel={col.label}
      value={textOf(p.value)}
      onChangeText={p.onChange}
    />
  );
}

export function RecordsField(p: {
  field: RecordsSpec;
  value: unknown;
  onChange(v: BlueprintRecord[]): void;
}): ReactNode {
  const { t } = useI18n();
  const { field } = p;
  const rows = recordsOf(p.value);
  const item = field.itemLabel ?? t('form.row');
  const min = field.minItems ?? 0;
  return (
    <View style={styles.stack}>
      {rows.map((row, i) => (
        <View key={i} style={styles.stack}>
          <RowHead
            item={item}
            n={i}
            count={rows.length}
            min={min}
            onMove={(d) => p.onChange(moveAt(rows, i, d))}
            onRemove={() => p.onChange(removeAt(rows, i))}
          />
          {field.columns.map((col) => (
            <Cell
              key={col.key}
              fieldKey={field.key}
              row={i}
              col={col}
              value={row[col.key]}
              onChange={(v) => p.onChange(setCell(rows, i, col, v))}
            />
          ))}
        </View>
      ))}
      <ActionButton
        label={t('form.add', { item })}
        variant="secondary"
        compact
        icon="plus"
        disabled={field.maxItems !== undefined && rows.length >= field.maxItems}
        testID={`field-${field.key}-add`}
        onPress={() => {
          tapFeedback();
          p.onChange([...rows, blankRecord(field.columns)]);
        }}
        style={styles.self}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', minHeight: 32 },
  grow: { flex: 1 },
  self: { alignSelf: 'flex-start' },
});
