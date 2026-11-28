// Small labelled controls shared by the Visual DNA axes: option chips, steppers and groups.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { tapFeedback } from '../ui/haptics.ts';
import { Press } from '../ui/Press.tsx';
import { useTheme } from '../ui/theme.tsx';
import { chipStates } from './dna-choice.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';
import type { StringKey } from '../i18n/i18n.ts';
import { Stepper } from '../ui/Stepper.tsx';
import { Txt } from '../ui/Txt.tsx';
import { radius, space, TOUCH } from '../ui/tokens.ts';

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

/**
 * Radio chips. Selection is the only fill: a chip never takes the Press hover / pressed wash, so a
 * sticky hover on the last-touched chip (e.g. Typewriter) cannot read as a second selection.
 */
export function Choice<T extends string>(p: {
  id: string;
  label: StringKey;
  prefix: string;
  values: readonly T[];
  value: T;
  onPick(v: T): void;
}): ReactNode {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <Labeled label={t(p.label)}>
      <View style={chipStyles.grid} accessibilityRole="radiogroup">
        {chipStates(p.values, p.value).map(({ value, active }) => {
          const label = t(`${p.prefix}.${value}` as StringKey);
          return (
            <Press
              key={value}
              wash={null}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ selected: active, checked: active }}
              testID={`dna-${p.id}-${value}`}
              onPress={() => {
                tapFeedback();
                p.onPick(value);
              }}
              style={[
                chipStyles.tile,
                {
                  borderColor: active ? colors.accent : colors.hairline,
                  backgroundColor: active ? colors.accentSoft : 'transparent',
                },
              ]}
            >
              <Txt
                variant="label"
                color={active ? 'accent' : 'ink'}
                numberOfLines={2}
                style={chipStyles.label}
              >
                {label}
              </Txt>
            </Press>
          );
        })}
      </View>
    </Labeled>
  );
}

const chipStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  tile: {
    width: '48.5%',
    minHeight: TOUCH,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    justifyContent: 'center',
  },
  label: { textAlign: 'center' },
});

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
