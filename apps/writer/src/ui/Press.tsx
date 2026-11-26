// Folio pressable: a quiet `surfaceTint` wash while pressed / hovered, clipped to the surface's own
// rounded box (overflow hidden whenever a radius is set) with a bounded Android ripple, plus a
// hitSlop helper that grows small visuals to the 48dp touch minimum.
import { hitSlopFor } from './a11y.ts';
import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { boundedRipple, withClip } from './press-shape.ts';
import { useTheme } from './theme.tsx';

export interface PressProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  /** Pressed wash colour (default `surfaceTint`); `null` disables it. */
  wash?: string | null;
  children?: ReactNode;
}

export function Press({ style, wash, children, ...rest }: PressProps): ReactNode {
  const { colors } = useTheme();
  const tint = wash === undefined ? colors.surfaceTint : wash;
  const clip = withClip(StyleSheet.flatten(style) as ViewStyle | undefined);
  // On Android the bounded ripple is the press feedback; a static wash under it would double-tint.
  const ripple = Platform.OS === 'android' && tint ? boundedRipple(tint) : undefined;
  const washOn = (s: { pressed: boolean; hovered?: boolean }): boolean =>
    s.hovered === true || (s.pressed && !(rest.android_ripple ?? ripple));
  return (
    <Pressable
      android_ripple={ripple}
      {...rest}
      // `hovered` comes from react-native-web; native typings may not declare it.
      style={(state) => [
        style,
        clip,
        tint && washOn(state as { pressed: boolean; hovered?: boolean })
          ? { backgroundColor: tint }
          : null,
        rest.disabled ? { opacity: 0.38 } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

/** hitSlop that grows a visual control of `width × height` to the 48dp touch minimum. */
export const slop = hitSlopFor;
