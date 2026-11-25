// Chevron buttons that collapse / expand one half of the formatting toolbar. Like every toolbar
// button they refuse focus, so the keyboard and the TextInput selection survive the tap.
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { Glyph } from '../ui/Glyph.tsx';
import { hitSlopFor } from '../ui/a11y.ts';
import { TOUCH } from '../ui/tokens.ts';

export type ToolbarHalf = 'format' | 'add';

const LABELS: Readonly<Record<ToolbarHalf, { hide: string; show: string }>> = {
  format: { hide: 'Hide formatting tools', show: 'Show formatting tools' },
  add: { hide: 'Hide add-block tools', show: 'Show add-block tools' },
};

export interface ToolbarChevronProps {
  half: ToolbarHalf;
  /** `collapse` is the compact edge button; `expand` is the lone 44dp restore button. */
  mode: 'collapse' | 'expand';
  onPress(): void;
}

/** Format half collapses leftwards, add half rightwards; expanding points the other way. */
export function ToolbarChevron(p: ToolbarChevronProps): ReactNode {
  const leftFacing = (p.half === 'format') === (p.mode === 'collapse');
  const label = LABELS[p.half][p.mode === 'collapse' ? 'hide' : 'show'];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      focusable={false}
      onPress={p.onPress}
      testID={`toolbar-${p.mode}-${p.half}`}
      hitSlop={hitSlopFor(p.mode === 'expand' ? TOUCH : 28, TOUCH)}
      style={{
        width: p.mode === 'expand' ? TOUCH : 28,
        height: TOUCH,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Glyph name={leftFacing ? 'chevron-left' : 'chevron-right'} size={16} color="inkMuted" />
    </Pressable>
  );
}
