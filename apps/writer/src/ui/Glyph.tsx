// Folio icon: Feather (thin 2px stroke) via @expo/vector-icons — the one icon family used
// everywhere in the writer.
import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps, ReactNode } from 'react';
import type { InkRole } from './Txt.tsx';
import { useTheme } from './theme.tsx';

export type GlyphName = ComponentProps<typeof Feather>['name'];

export interface GlyphProps {
  name: GlyphName;
  /** Visual size in dp (default 20). */
  size?: number;
  /** A Folio colour role (default `inkSecondary`) or a literal #hex. */
  color?: InkRole | `#${string}`;
}

export function Glyph({ name, size = 20, color = 'inkSecondary' }: GlyphProps): ReactNode {
  const { colors } = useTheme();
  const c = color.startsWith('#') ? color : colors[color as InkRole];
  return <Feather name={name} size={size} color={c} accessible={false} />;
}
