// M3 segmented button (single select): connected full-shape group, ✓ on the active segment.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText.tsx';
import { Icon, type IconName } from './Icon.tsx';
import { shape, space } from './m3-tokens.ts';
import { StatePressable } from './StateLayer.tsx';
import { useTheme } from './theme.tsx';

export interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

export interface SegmentedButtonsProps<T extends string> {
  segments: readonly Segment<T>[];
  value: T;
  onChange(value: T): void;
  accessibilityLabel: string;
  testID?: string;
}

export function SegmentedButtons<T extends string>(p: SegmentedButtonsProps<T>): ReactNode {
  const { m3 } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={p.accessibilityLabel}
      testID={p.testID}
      style={[styles.group, { borderColor: m3.outline }]}
    >
      {p.segments.map((s, i) => {
        const on = s.value === p.value;
        const fg = on ? 'onSecondaryContainer' : 'onSurface';
        return (
          <StatePressable
            key={s.value}
            accessibilityRole="radio"
            accessibilityLabel={s.label}
            accessibilityState={{ checked: on }}
            testID={p.testID ? `${p.testID}-${s.value}` : undefined}
            onPress={() => p.onChange(s.value)}
            layerColor={m3[fg]}
            style={[
              styles.segment,
              i > 0 && { borderLeftWidth: 1, borderColor: m3.outline },
              on && { backgroundColor: m3.secondaryContainer },
            ]}
          >
            <View style={styles.row}>
              {on ? (
                <Icon name="check" size={18} color={fg} />
              ) : s.icon ? (
                <Icon name={s.icon} size={18} color={fg} />
              ) : null}
              <AppText variant="labelLarge" color={fg} numberOfLines={1}>
                {s.label}
              </AppText>
            </View>
          </StatePressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: shape.full,
    overflow: 'hidden',
    minHeight: 40,
  },
  segment: { flex: 1, justifyContent: 'center', paddingHorizontal: space.sm, minHeight: 40 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
