// Folio toggle: slim 44×26 track with an inset round thumb that slides. No borders, no ✓.
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
    Animated.timing(x, { toValue: p.value ? 1 : 0, duration: 160, useNativeDriver: false }).start();
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
        { backgroundColor: p.value ? colors.accent : colors.borderStrong },
        p.disabled && styles.disabled,
      ]}
    >
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: p.value ? colors.onAccent : dark ? colors.ink : '#FFFFFF',
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
  track: { width: W, height: H, borderRadius: H / 2, padding: 3, justifyContent: 'center' },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 1.5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  disabled: { opacity: 0.38 },
});
