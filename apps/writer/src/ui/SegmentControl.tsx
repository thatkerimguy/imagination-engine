// Folio segment control: a `surface` track (10px radius, 3px inset) with a hairline thumb that slides
// (native-driver translateX) to the active segment. Segments share the width equally and never truncate short labels; no ✓.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Glyph, type GlyphName } from './Glyph.tsx';
import { tapFeedback } from './haptics.ts';
import { Txt } from './Txt.tsx';
import { radius } from './tokens.ts';
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
  const { colors } = useTheme();
  const h = p.compact ? 32 : 36;
  const [segs, setSegs] = useState<Record<string, { x: number; w: number }>>({});
  const tx = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const cur = segs[p.value];
  useEffect(() => {
    if (!cur) return;
    const x = cur.x - StyleSheet.hairlineWidth;
    if (!placed.current) {
      placed.current = true;
      tx.setValue(x);
      return;
    }
    Animated.timing(tx, { toValue: x, duration: 160, useNativeDriver: true }).start();
  }, [cur, tx]);
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
      {cur ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              width: cur.w,
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.hairline,
              transform: [{ translateX: tx }],
            },
          ]}
        />
      ) : null}
      {p.options.map((o) => {
        const on = o.value === p.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on, checked: on }}
            testID={o.testID}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              setSegs((m) => {
                const old = m[o.value];
                return old && old.x === x && old.w === width
                  ? m
                  : { ...m, [o.value]: { x, w: width } };
              });
            }}
            hitSlop={{ top: (44 - h) / 2 + 3, bottom: (44 - h) / 2 + 3 }}
            onPress={() => {
              if (on) return;
              tapFeedback();
              p.onChange(o.value);
            }}
            style={[
              styles.seg,
              p.hug ? styles.segHug : null,
              // Until the thumb is measured, the active segment paints its own fill.
              on && !cur && { backgroundColor: colors.surfaceElevated },
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
  thumb: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 0,
    borderRadius: radius.sm - 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segHug: { flex: 0, paddingHorizontal: 12 },
  onLabel: { fontWeight: '600' },
});
