// Folio underline tabs: plain text tabs on the canvas with a crisp 2px accent indicator under the
// active one and a hairline under the row. Tabs size to their labels (never "…"); `fill` spreads
// them evenly across the width.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { tapFeedback } from './haptics.ts';
import { Txt } from './Txt.tsx';
import { space } from './tokens.ts';
import { useTheme } from './theme.tsx';

export interface TabOption<T extends string> {
  value: T;
  label: string;
  testID?: string;
}

export interface UnderlineTabsProps<T extends string> {
  options: readonly TabOption<T>[];
  value: T;
  onChange(value: T): void;
  accessibilityLabel: string;
  /** Spread tabs evenly across the row (default: hug labels, left-aligned). */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function UnderlineTabs<T extends string>(p: UnderlineTabsProps<T>): ReactNode {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={p.accessibilityLabel}
      testID={p.testID}
      style={[styles.row, { borderColor: colors.hairline }, p.style]}
    >
      {p.options.map((o) => {
        const on = o.value === p.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            testID={o.testID}
            onPress={() => {
              if (on) return;
              tapFeedback();
              p.onChange(o.value);
            }}
            style={[styles.tab, p.fill ? styles.fill : null]}
          >
            <Txt
              variant="label"
              color={on ? 'ink' : 'inkMuted'}
              numberOfLines={1}
              style={[styles.label, on ? styles.onLabel : null]}
            >
              {o.label}
            </Txt>
            <View style={[styles.bar, on ? { backgroundColor: colors.accent } : null]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.lg, borderBottomWidth: 1 },
  tab: { minHeight: 44, justifyContent: 'flex-end', alignItems: 'center' },
  fill: { flex: 1 },
  label: { paddingBottom: 10, fontSize: 14 },
  onLabel: { fontWeight: '600' },
  bar: { height: 2, alignSelf: 'stretch', borderRadius: 1, marginBottom: -1 },
});
