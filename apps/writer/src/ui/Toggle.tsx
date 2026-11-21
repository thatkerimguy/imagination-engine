// Folio toggle: slim 44x26 track (accent layer crossfades over a neutral one) with a sliding thumb;
// everything animates on the native driver (opacity + transform only). Hairline, no shadow.
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { toggleFeedback } from './haptics.ts';
import { slop } from './Press.tsx';
import { useTheme } from './theme.tsx';

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
  const x = useRef(new Animated.Value(p.value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(x, { toValue: p.value ? 1 : 0, duration: 160, useNativeDriver: true }).start();
  }, [p.value, x]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={p.accessibilityLabel}
      accessibilityState={{ checked: p.value, disabled: !!p.disabled }}
      disabled={p.disabled}
      onPress={() => {
        toggleFeedback(!p.value);
        p.onValueChange(!p.value);
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
            backgroundColor: p.value ? colors.onAccent : dark ? colors.ink : '#FFFFFF',
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
