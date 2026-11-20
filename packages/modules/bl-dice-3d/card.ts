import type { ModuleCardFormatter } from '@kn/core';
import type { DiceMaterial, DiceProps } from './schema.ts';

const MATERIAL: Record<DiceMaterial, string> = {
  ivory: 'Ivory',
  'casino-red': 'Casino Red',
  brass: 'Brass',
  obsidian: 'Obsidian',
};

export const formatCardSummary: ModuleCardFormatter<DiceProps> = (p) => {
  const outcome =
    p.outcomeMode === 'scripted' ? `Scripted [${p.scriptedNumbers.join(', ')}]` : 'True random';
  const trigger = p.trigger === 'auto' ? 'Auto throw' : 'Tap or shake';
  return {
    title: `🎲 ${p.count}× D6 · ${MATERIAL[p.material]}`,
    subtitle: `${outcome} · ${trigger}`,
    badge: p.outcomeMode === 'scripted' ? 'SCRIPTED' : 'RANDOM',
  };
};
