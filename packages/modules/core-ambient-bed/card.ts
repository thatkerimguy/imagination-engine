import type { ModuleCardFormatter } from '@kn/core';
import type { AmbientBedProps } from './schema.ts';

const NAMES: Record<AmbientBedProps['preset'], string> = {
  rain: 'Rain',
  barroom: 'Barroom hum',
  'neon-hum': 'Neon hum',
  custom: 'Custom audio',
};

export const formatCardSummary: ModuleCardFormatter<AmbientBedProps> = (p) => {
  if (p.action === 'stop') {
    return { title: '🔇 Ambience fades out', subtitle: `Over ${p.fadeSeconds}s` };
  }
  const name = p.preset === 'custom' ? p.asset.split('/').pop() || NAMES.custom : NAMES[p.preset];
  return {
    title: `🌧️ ${name}`,
    subtitle: `Crossfade ${p.fadeSeconds}s · Volume ${Math.round(p.volume * 100)}%`,
    badge: 'AMBIENCE',
  };
};
