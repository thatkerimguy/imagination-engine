// Folio underline tabs: plain text tabs on the canvas with a crisp 2px accent indicator under the
// active one and a hairline under the row. Tabs size to their labels (never "…"); `fill` spreads
// them evenly across the width. Labels keep one weight in both states, so selecting a tab can
// never widen it past its measured box ("Note…"); a row that cannot fit scrolls horizontally.
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { tapFeedback } from './haptics.ts';
import { Txt } from './Txt.tsx';
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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={p.accessibilityLabel}
      testID={p.testID}
      style={[styles.scroll, { borderColor: colors.hairline }, p.style]}
      contentContainerStyle={styles.row}
    >
      {p.options.map((o) => {
        const on = o.value === p.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            aria-selected={on}
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
              style={styles.label}
            >
              {o.label}
            </Txt>
            <View style={[styles.bar, on ? { backgroundColor: colors.accent } : null]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, borderBottomWidth: 1 },
  row: { flexGrow: 1, flexDirection: 'row' },
  tab: { minHeight: 44, flexShrink: 0, paddingHorizontal: 14, justifyContent: 'flex-end' },
  fill: { flex: 1, flexShrink: 0 },
  label: {
    paddingBottom: 10,
    fontSize: 14,
    letterSpacing: 0,
    includeFontPadding: false,
    fontWeight: '600',
    textAlign: 'center',
  },
  bar: { height: 2, borderRadius: 1, marginBottom: -1, marginHorizontal: -14 },
});
