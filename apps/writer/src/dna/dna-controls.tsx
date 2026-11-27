// Small labelled controls shared by the Visual DNA axes: option chips, steppers and groups.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { OptionGrid } from '../forms/controls/OptionGrid.tsx';
import { useI18n } from '../i18n/I18nProvider.tsx';
import type { StringKey } from '../i18n/i18n.ts';
import { Stepper } from '../ui/Stepper.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';

export function Labeled({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <View style={{ gap: space.xxs }}>
      <Txt variant="label" color="inkSecondary" style={{ flexShrink: 1 }}>
        {label}
      </Txt>
      {children}
    </View>
  );
}

export function Choice<T extends string>(p: {
  id: string;
  label: StringKey;
  prefix: string;
  values: readonly T[];
  value: T;
  onPick(v: T): void;
}): ReactNode {
  const { t } = useI18n();
  return (
    <Labeled label={t(p.label)}>
      <OptionGrid
        role="radio"
        options={p.values.map((v) => ({ value: v, label: t(`${p.prefix}.${v}` as StringKey) }))}
        isSelected={(v) => v === p.value}
        onPick={(v) => p.onPick(v as T)}
        testIDFor={(v) => `dna-${p.id}-${v}`}
      />
    </Labeled>
  );
}

export function Num(p: {
  id: string;
  label: StringKey;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange(v: number): void;
}): ReactNode {
  const { t } = useI18n();
  return (
    <Labeled label={t(p.label)}>
      <View style={{ alignItems: 'flex-start' }}>
        <Stepper
          testID={`dna-${p.id}`}
          label={t(p.label)}
          value={p.value}
          min={p.min}
          max={p.max}
          step={p.step}
          onChange={p.onChange}
          caption={`${p.min} – ${p.max}`}
        />
      </View>
    </Labeled>
  );
}

export function Group({ title, children }: { title: StringKey; children: ReactNode }): ReactNode {
  const { t } = useI18n();
  return (
    <View style={{ gap: space.md, paddingTop: space.md }}>
      <Txt variant="bodyStrong" accessibilityRole="header">
        {t(title)}
      </Txt>
      {children}
    </View>
  );
}
