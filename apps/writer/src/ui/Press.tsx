// Folio pressable: a quiet `surfaceTint` wash while pressed / hovered (no ripples, no overlays),
// plus a hitSlop helper that grows small visuals to the 44dp touch minimum.
import type { ReactNode } from 'react';
import {
  Pressable,
  type Insets,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from './theme.tsx';
import { TOUCH } from './tokens.ts';

export interface PressProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  /** Pressed wash colour (default `surfaceTint`); `null` disables it. */
  wash?: string | null;
  children?: ReactNode;
}

export function Press({ style, wash, children, ...rest }: PressProps): ReactNode {
  const { colors } = useTheme();
  const tint = wash === undefined ? colors.surfaceTint : wash;
  return (
    <Pressable
      {...rest}
      style={({ pressed, hovered }) => [
        style,
        tint && (pressed || hovered) ? { backgroundColor: tint } : null,
        rest.disabled ? { opacity: 0.38 } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

/** hitSlop that grows a visual control of `width × height` to the 44dp touch minimum. */
export function slop(width: number, height = width): Insets {
  const x = Math.max(0, (TOUCH - width) / 2);
  const y = Math.max(0, (TOUCH - height) / 2);
  return { top: y, bottom: y, left: x, right: x };
}
