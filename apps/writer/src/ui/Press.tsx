// Folio pressable: a quiet `surfaceTint` wash while pressed / hovered (no ripples, no overlays),
// plus a hitSlop helper that grows small visuals to the 48dp touch minimum.
import { hitSlopFor } from './a11y.ts';
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
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
  return (
    <Pressable
      {...rest}
      // `hovered` comes from react-native-web; native typings may not declare it.
      style={(state) => [
        style,
        tint && (state.pressed || (state as { hovered?: boolean }).hovered === true)
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
