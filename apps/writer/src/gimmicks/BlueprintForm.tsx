// Schema-driven cue editor: renders one control per `blueprint.fields`, validates with the core
// field rules, shows errors inline and reports `{ blueprintId, ...props }` (null while invalid).
import type { BlueprintFieldSpec, GimmickBlueprint } from '@kn/core/gimmicks';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { BooleanField, ColorField, NumberField, SelectField, TextField } from './form-fields.tsx';
import { ListField, RecordsField } from './form-records.tsx';
import {
  errorCount,
  fieldErrors,
  initialValues,
  setValue,
  toCueProps,
  type FormValues,
} from './form-model.ts';

export interface BlueprintFormProps {
  blueprint: GimmickBlueprint;
  /** The cue's stored field props (may be partial; defaults fill the gaps). */
  initialProps: Record<string, unknown>;
  /** Called on every edit with the valid cue props, or null while a field is invalid. */
  onChange(props: Record<string, unknown> | null): void;
}

function Control(p: {
  f: BlueprintFieldSpec;
  value: unknown;
  invalid: boolean;
  set(v: Parameters<typeof setValue>[2]): void;
}): ReactNode {
  const { f, value, invalid } = p;
  const common = { value, invalid, onChange: p.set as (v: string | number | boolean) => void };
  switch (f.type) {
    case 'text':
    case 'multiline':
      return <TextField field={f} {...common} />;
    case 'select':
      return <SelectField field={f} {...common} />;
    case 'number':
      return <NumberField field={f} {...common} />;
    case 'boolean':
      return <BooleanField field={f} {...common} />;
    case 'color':
      return <ColorField field={f} {...common} />;
    case 'list':
      return <ListField field={f} value={value} invalid={invalid} onChange={p.set} />;
    case 'records':
      return <RecordsField field={f} value={value} onChange={p.set} />;
  }
}

export function BlueprintForm({
  blueprint: bp,
  initialProps,
  onChange,
}: BlueprintFormProps): ReactNode {
  const { t } = useI18n();
  const [values, setValues] = useState<FormValues>(() => initialValues(bp, initialProps));
  const errors = useMemo(() => fieldErrors(bp, values), [bp, values]);
  const emit = useRef(onChange);
  emit.current = onChange;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) return void (first.current = false);
    emit.current(toCueProps(bp, values));
  }, [bp, values]);
  return (
    <View style={styles.form} testID="blueprint-form">
      {bp.fields.map((f) => {
        const errs = errors[f.key] ?? [];
        return (
          <View key={f.key} style={styles.field}>
            {f.type !== 'boolean' ? (
              <Txt
                variant="label"
                color={errs.length ? 'danger' : 'inkSecondary'}
                style={styles.label}
              >
                {f.optional ? `${f.label} (${t('form.optional')})` : f.label}
              </Txt>
            ) : null}
            <Control
              f={f}
              value={values[f.key]}
              invalid={errs.length > 0}
              set={(v) => setValues((cur) => setValue(cur, f, v))}
            />
            {f.help && !errs.length ? (
              <Txt variant="caption" color="inkMuted">
                {f.help}
              </Txt>
            ) : null}
            {errs.map((e) => (
              <Txt key={e} variant="caption" color="danger" testID={`field-error-${f.key}`}>
                {e}
              </Txt>
            ))}
          </View>
        );
      })}
      {errorCount(errors) > 0 ? (
        <Txt variant="meta" color="danger">
          {t('form.invalid')}
        </Txt>
      ) : null}
      <ActionButton
        label={t('form.reset')}
        variant="ghost"
        quiet
        icon="rotate-ccw"
        testID="blueprint-form-reset"
        onPress={() => setValues(initialValues(bp, bp.sampleProps))}
        style={styles.reset}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  field: { gap: space.xxs },
  label: { flexShrink: 1 },
  reset: { alignSelf: 'flex-start' },
});
