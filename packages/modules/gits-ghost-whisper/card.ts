import type { ModuleCardFormatter } from '@kn/core';
import type { GhostWhisperProps } from './schema.ts';

const preview = (s: string): string => {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > 28 ? `${flat.slice(0, 27)}…` : flat;
};

export const formatCardSummary: ModuleCardFormatter<GhostWhisperProps> = (p) => ({
  title: `👻 Ghost line · ${p.accent.charAt(0).toUpperCase()}${p.accent.slice(1)}`,
  subtitle: `“${preview(p.surfaceLine)}” ⟶ “${preview(p.ghostLine)}”`,
  badge: p.revealMode === 'hold-only' ? 'HOLD' : 'HOLD/TILT',
});
