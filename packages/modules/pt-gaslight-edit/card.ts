import type { ModuleCardFormatter } from '@kn/core';
import type { GaslightProps } from './schema.ts';

const MAX = 28;

const preview = (text: string): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > MAX ? `${flat.slice(0, MAX - 1)}…` : flat;
};

export const formatCardSummary: ModuleCardFormatter<GaslightProps> = (p) => ({
  title: `🕯️ Gaslight · after ${p.triggerDistancePx}px`,
  subtitle: `“${preview(p.initialText)}” → “${preview(p.mutatedText)}”`,
  badge: p.once ? 'ONCE' : 'LOOPS',
});
