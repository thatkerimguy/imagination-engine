// M3 state layer: a Pressable whose pressed/hovered state paints a translucent overlay of the
// content colour (8–12 %), instead of fading the whole control. Give the pressable
// `overflow: 'hidden'` and its radius so the layer follows the shape.
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type Insets,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { stateLayer, withAlpha } from './m3-tokens.ts';

export interface StatePressableProps extends Omit<PressableProps, 'style' | 'children'> {
  /** Colour of the overlay — use the content ("on…") colour of the surface. */
  layerColor: string;
  style?: StyleProp<ViewStyle>;
  hitSlop?: Insets | number;
  children?: ReactNode;
}

export function StatePressable({
  layerColor,
  style,
  children,
  ...rest
}: StatePressableProps): ReactNode {
  return (
    <Pressable {...rest} style={style}>
      {({ pressed, hovered }) => (
        <>
          {children}
          {pressed || hovered ? (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: withAlpha(
                    layerColor,
                    pressed ? stateLayer.pressed : stateLayer.hover,
                  ),
                },
              ]}
            />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

/** hitSlop that grows a visual control of `size` to the 48dp minimum touch target. */
export function slopFor(width: number, height = width): Insets {
  const x = Math.max(0, (48 - width) / 2);
  const y = Math.max(0, (48 - height) / 2);
  return { top: y, bottom: y, left: x, right: x };
}
