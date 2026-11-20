// M3 switch: 52×32 track (outlined surfaceContainerHighest off, primary on), 16dp thumb off →
// 24dp thumb with ✓ on. Drawn natively so it looks identical on iOS, Android and web.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from './Icon.tsx';
import { shape } from './m3-tokens.ts';
import { slopFor } from './StateLayer.tsx';
import { useTheme } from './theme.tsx';

export interface SwitchProps {
  value: boolean;
  onValueChange(next: boolean): void;
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
}

export function Switch(p: SwitchProps): ReactNode {
  const { m3 } = useTheme();
  const on = p.value;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={p.accessibilityLabel}
      accessibilityState={{ checked: on, disabled: !!p.disabled }}
      disabled={p.disabled}
      onPress={() => p.onValueChange(!on)}
      testID={p.testID}
      hitSlop={slopFor(52, 32)}
      style={[
        styles.track,
        on
          ? { backgroundColor: m3.primary, borderColor: m3.primary }
          : { backgroundColor: m3.surfaceContainerHighest, borderColor: m3.outline },
        p.disabled && styles.disabled,
      ]}
    >
      <View
        style={[
          on ? styles.thumbOn : styles.thumbOff,
          { backgroundColor: on ? m3.onPrimary : m3.outline },
        ]}
      >
        {on ? <Icon name="check" size={16} color="primary" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 52,
    height: 32,
    borderRadius: shape.full,
    borderWidth: 2,
    justifyContent: 'center',
  },
  thumbOff: { width: 16, height: 16, borderRadius: 8, marginLeft: 6 },
  thumbOn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginLeft: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.38 },
});
