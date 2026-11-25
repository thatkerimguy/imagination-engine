// Folio segment control: a `surface` track (10px radius, 3px inset) with a hairline thumb that slides
// (native-driver translateX) to the active segment. Segments share the width equally and never truncate short labels; no ✓.
import { startTransition, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  mergeSeg,
  SLIDE_MS,
  slideAction,
  syncOptimistic,
  thumbTarget,
  type Seg,
} from './control-math.ts';
import { hitSlopFor, MIN_TOUCH } from './a11y.ts';
import { Glyph, type GlyphName } from './Glyph.tsx';
import { tapFeedback } from './haptics.ts';
import { Txt } from './Txt.tsx';
import { radius } from './tokens.ts';
import { useTheme } from './theme.tsx';

/** The native driver runs the thumb off the JS thread; react-native-web has none (it warns). */
const NATIVE_DRIVER = Platform.OS !== 'web';

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
  const [segs, setSegs] = useState<Record<string, Seg>>({});
  // Optimistic active value: a tap moves the thumb on frame 0, before the parent re-renders.
  const [st, setSt] = useState({ active: p.value, ext: p.value });
  const active = syncOptimistic(st.active, st.ext, p.value);
  if (st.ext !== p.value) setSt({ active: p.value, ext: p.value });
  const tx = useRef(new Animated.Value(0)).current;
  const lastX = useRef<number | null>(null);
  const slideTo = (seg: Seg | undefined): void => {
    if (!seg) return;
    const x = thumbTarget(seg, StyleSheet.hairlineWidth);
    const action = slideAction(lastX.current, x);
    lastX.current = x;
    if (action === 'place') tx.setValue(x);
    else if (action === 'slide')
      Animated.timing(tx, {
        toValue: x,
        duration: SLIDE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: NATIVE_DRIVER,
      }).start();
  };
  const cur = segs[active];
  useEffect(() => slideTo(cur), [cur?.x, cur?.w]); // eslint-disable-line react-hooks/exhaustive-deps
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
        const on = o.value === active;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on, checked: on }}
            aria-checked={on}
            testID={o.testID}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              setSegs((m) => mergeSeg(m, o.value, x, width));
            }}
            hitSlop={hitSlopFor(MIN_TOUCH, h - 6)}
            onPress={() => {
              if (on) return;
              tapFeedback();
              setSt({ active: o.value, ext: p.value });
              slideTo(segs[o.value]);
              startTransition(() => p.onChange(o.value));
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
    minWidth: MIN_TOUCH,
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
