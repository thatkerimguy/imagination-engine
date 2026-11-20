// Preset colour swatches for fg/bg colouring.
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { space, TOUCH } from '../ui/tokens.ts';

export const COLOR_PRESETS: readonly string[] = [
  '#e53935',
  '#fb8c00',
  '#fdd835',
  '#43a047',
  '#1e88e5',
  '#8e24aa',
  '#6d4c41',
  '#212121',
];

/** Eight preset swatches for fg/bg colouring; touch-safe (keeps the input focused). */
export function ColorSwatchRow(p: {
  onPick(hex: string): void;
  colors?: readonly string[];
}): ReactNode {
  const list = p.colors ?? COLOR_PRESETS;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }} testID="color-swatches">
      {list.map((hex) => (
        <Pressable
          key={hex}
          accessibilityRole="button"
          accessibilityLabel={`Colour ${hex}`}
          focusable={false}
          onPress={() => p.onPick(hex)}
          testID={`swatch-${hex.slice(1)}`}
          style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: hex,
              borderWidth: 1,
              borderColor: 'rgba(128,128,128,0.5)',
            }}
          />
        </Pressable>
      ))}
    </View>
  );
}
