// Folio segment control: a `surface` track (10px radius, 3px inset) with an elevated thumb on the
// active segment. Segments share the width equally and never truncate short labels; no ✓.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Glyph, type GlyphName } from './Glyph.tsx';
import { tapFeedback } from './haptics.ts';
import { Txt } from './Txt.tsx';
import { lift, radius } from './tokens.ts';
import { useTheme } from './theme.tsx';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: GlyphName;
  testID?: string;
}

export interface SegmentControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange(value: T): void;
  accessibilityLabel: string;
  /** 32dp track instead of 36dp (filter rows). */
  compact?: boolean;
  /** Size to content instead of filling the row. */
  hug?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SegmentControl<T extends string>(p: SegmentControlProps<T>): ReactNode {
  const { colors, dark } = useTheme();
  const h = p.compact ? 32 : 36;
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={p.accessibilityLabel}
      testID={p.testID}
      style={[
        styles.track,
        { height: h, backgroundColor: colors.surface, borderColor: colors.hairline },
        p.hug ? styles.hug : null,
        p.style,
      ]}
    >
      {p.options.map((o) => {
        const on = o.value === p.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on, checked: on }}
            testID={o.testID}
            hitSlop={{ top: (44 - h) / 2 + 3, bottom: (44 - h) / 2 + 3 }}
            onPress={() => {
              if (on) return;
              tapFeedback();
              p.onChange(o.value);
            }}
            style={[
              styles.seg,
              p.hug ? styles.segHug : null,
              on && [
                { backgroundColor: colors.surfaceElevated, borderColor: colors.hairline },
                lift(dark),
              ],
            ]}
          >
            {o.icon ? <Glyph name={o.icon} size={14} color={on ? 'ink' : 'inkSecondary'} /> : null}
            <Txt
              variant="label"
              color={on ? 'ink' : 'inkSecondary'}
              numberOfLines={1}
              style={on ? styles.onLabel : null}
            >
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: 3,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hug: { alignSelf: 'flex-start' },
  seg: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm - 3,
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  segHug: { flex: 0, paddingHorizontal: 12 },
  onLabel: { fontWeight: '600' },
});
