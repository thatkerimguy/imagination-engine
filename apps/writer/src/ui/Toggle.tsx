// Folio toggle: slim 44x26 track (accent layer crossfades over a neutral one) with a sliding thumb;
// everything animates on the native driver (opacity + transform only). Hairline, no shadow.
import { startTransition, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet } from 'react-native';
import { SLIDE_MS, syncOptimistic } from './control-math.ts';
import { toggleFeedback } from './haptics.ts';
import { slop } from './Press.tsx';
import { useTheme } from './theme.tsx';

const NATIVE_DRIVER = Platform.OS !== 'web';

export interface ToggleProps {
  value: boolean;
  onValueChange(next: boolean): void;
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
}

const W = 44;
const H = 26;
const THUMB = 20;
const TRAVEL = W - THUMB - 6;

export function Toggle(p: ToggleProps): ReactNode {
  const { colors, dark } = useTheme();
  // Optimistic value: the thumb starts sliding on the tap's frame, before the parent re-renders.
  const [st, setSt] = useState({ on: p.value, ext: p.value });
  const on = syncOptimistic(st.on, st.ext, p.value);
  if (st.ext !== p.value) setSt({ on: p.value, ext: p.value });
  const x = useRef(new Animated.Value(p.value ? 1 : 0)).current;
  const target = useRef(p.value ? 1 : 0);
  const slide = (next: boolean): void => {
    const to = next ? 1 : 0;
    if (target.current === to) return;
    target.current = to;
    Animated.timing(x, {
      toValue: to,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  };
  useEffect(() => slide(on));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={p.accessibilityLabel}
      accessibilityState={{ checked: on, disabled: !!p.disabled }}
      aria-checked={on}
      aria-disabled={!!p.disabled}
      disabled={p.disabled}
      onPress={() => {
        const next = !on;
        toggleFeedback(next);
        setSt({ on: next, ext: p.value });
        slide(next);
        startTransition(() => p.onValueChange(next));
      }}
      testID={p.testID}
      hitSlop={slop(W, H)}
      style={[
        styles.track,
        { backgroundColor: colors.borderStrong, borderColor: colors.hairline },
        p.disabled && styles.disabled,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.accent, opacity: x }]}
      />
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: on ? colors.onAccent : dark ? colors.ink : '#FFFFFF',
            borderColor: colors.hairline,
            transform: [
              { translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] }) },
            ],
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: W,
    height: H,
    borderRadius: H / 2,
    padding: 3,
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  disabled: { opacity: 0.38 },
});
