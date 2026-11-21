import type { ModuleCard, ModuleCardFormatter } from '@kn/core';
import type { LighterProps } from './schema.ts';

export const formatCardSummary: ModuleCardFormatter<LighterProps> = (p): ModuleCard => {
  const badge = p.sfx ? { badge: 'SFX' } : {};
  if (p.action === 'extinguish') {
    return { title: '🔥 Extinguish', subtitle: 'Snaps the lid shut', ...badge };
  }
  const corner = p.corner === 'bottom-left' ? 'Bottom left' : 'Bottom right';
  const how = p.trigger === 'tap' ? 'Tap' : 'Auto';
  const burn =
    p.autoExtinguishMs > 0 ? `out after ${p.autoExtinguishMs / 1000}s` : 'burns until extinguished';
  return { title: `🔥 Ignite · ${corner}`, subtitle: `${how} · ${burn}`, ...badge };
};
