import type { ModuleCardFormatter } from '@kn/core';
import type { SystemBoxProps } from './schema.ts';

export const formatCardSummary: ModuleCardFormatter<SystemBoxProps> = (p) => ({
  title: `📟 ${p.title}`,
  subtitle: `${p.lines.length} ${p.lines.length === 1 ? 'line' : 'lines'} · ${p.header}`,
  badge: p.variant.toUpperCase(),
});
