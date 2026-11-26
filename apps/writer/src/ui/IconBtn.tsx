// Folio icon button: 44dp box + hitSlop to a 48dp touch target, 20px Feather glyph, circular clipped tint on press, optional
// active accent state. No fills, no pills.
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Glyph, type GlyphName } from './Glyph.tsx';
import { hitSlopFor } from './a11y.ts';
import { Press } from './Press.tsx';
import type { InkRole } from './Txt.tsx';
import { circleBox } from './press-shape.ts';
import { TOUCH } from './tokens.ts';
import { useTheme } from './theme.tsx';

export interface IconBtnProps {
  icon: GlyphName;
  /** Required: icon-only controls must be labelled for screen readers. */
  accessibilityLabel: string;
  onPress(): void;
  /** Glyph colour role (default `inkSecondary`; `accent` when active). */
  color?: InkRole;
  /** Active / toggled-on state: accent glyph on a soft tint. */
  active?: boolean;
  /** Glyph size (default 20). The touch target stays 48dp. */
  size?: number;
  /** Visual box (default 44). Smaller boxes keep a 48dp target via hitSlop. */
  box?: number;
  disabled?: boolean;
  testID?: string;
}

export function IconBtn(p: IconBtnProps): ReactNode {
  const { colors } = useTheme();
  const box = p.box ?? TOUCH;
  const color: InkRole = p.active ? 'accent' : (p.color ?? 'inkSecondary');
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={p.accessibilityLabel}
      accessibilityState={{ disabled: !!p.disabled, selected: p.active }}
      disabled={p.disabled}
      onPress={p.onPress}
      testID={p.testID}
      hitSlop={hitSlopFor(box)}
      style={[
        styles.base,
        circleBox(box),
        p.active ? { backgroundColor: colors.surfaceTint } : null,
      ]}
    >
      <Glyph name={p.icon} size={p.size ?? 20} color={color} />
    </Press>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
