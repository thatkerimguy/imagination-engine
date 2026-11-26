// Folio action button: primary (solid accent), secondary (surface + hairline), ghost (text only)
// and danger. 44dp tall, 10px radius, optional leading Feather glyph.
import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Glyph, type GlyphName } from './Glyph.tsx';
import { Press } from './Press.tsx';
import { Txt, type InkRole } from './Txt.tsx';
import { clipped } from './press-shape.ts';
import { radius, space, TOUCH } from './tokens.ts';
import { useTheme } from './theme.tsx';

export type ActionVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ActionButtonProps {
  label: string;
  onPress(): void;
  variant?: ActionVariant;
  icon?: GlyphName;
  /** Compact 36dp visual (the touch target still reaches 44dp). */
  compact?: boolean;
  /** Ghost only: ink text instead of accent. */
  quiet?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function ActionButton(p: ActionButtonProps): ReactNode {
  const { colors } = useTheme();
  const variant = p.variant ?? 'primary';
  const fg: InkRole =
    variant === 'primary'
      ? 'onAccent'
      : variant === 'danger'
        ? 'danger'
        : variant === 'ghost' && p.quiet
          ? 'inkSecondary'
          : variant === 'ghost'
            ? 'accent'
            : 'ink';
  const box: ViewStyle =
    variant === 'primary'
      ? { backgroundColor: colors.accent }
      : variant === 'secondary'
        ? { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline }
        : variant === 'danger'
          ? { backgroundColor: colors.dangerSoft }
          : {};
  const height = p.compact ? 36 : TOUCH;
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={p.accessibilityLabel ?? p.label}
      accessibilityState={{ disabled: !!p.disabled }}
      disabled={p.disabled}
      onPress={p.onPress}
      testID={p.testID}
      hitSlop={p.compact ? { top: 4, bottom: 4 } : undefined}
      wash={variant === 'primary' ? colors.borderStrong : undefined}
      style={[
        styles.base,
        { height, paddingHorizontal: variant === 'ghost' ? space.xs : space.md },
        box,
        p.style,
      ]}
    >
      {p.icon ? <Glyph name={p.icon} size={16} color={fg} /> : null}
      <Txt variant="label" color={fg} style={styles.label} numberOfLines={1}>
        {p.label}
      </Txt>
    </Press>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    ...clipped(radius.sm),
  },
  label: { fontWeight: '600' },
});
