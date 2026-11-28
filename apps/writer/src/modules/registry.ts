// Legacy v1 module lookup (now empty). See writerModules below.
import type { ModuleCard, ModuleMeta, ModuleSchemaDefinition } from '@kn/core';
import { starterCueBlueprint } from '../gimmicks/cue.ts';

type Props = Record<string, unknown>;

/** A module with its prop type erased, so screens can treat every gimmick the same way. */
export interface WriterModule {
  meta: ModuleMeta;
  schema: ModuleSchemaDefinition<Props>;
  /** Card for a block's stored props; falls back gracefully when props are invalid. */
  summarize(props: Props): ModuleCard;
}

/**
 * Legacy v1 modules are retired: v2 gimmicks live in the blueprint catalog. The registry stays
 * as the (empty) lookup for pre-v2 `module` blocks, which degrade to fallback lines elsewhere.
 */
export const writerModules: readonly WriterModule[] = [];

const byId = new Map(writerModules.map((m) => [m.meta.id, m]));

export const getWriterModule = (id: string): WriterModule | undefined => byId.get(id);

/** Modules a novel may insert, in registry order. Unknown ids in the manifest are ignored. */
export const enabledWriterModules = (enabled: readonly string[]): WriterModule[] =>
  writerModules.filter((m) => enabled.includes(m.meta.id));

/** Leading emoji / symbols of a card title ("🌧️ Rain" → "Rain"). */
const stripLeadingSymbols = (s: string): string => s.replace(/^[^\p{L}\p{N}]+/u, '').trim();

/**
 * Human-readable outline label for a gimmick block: module name plus its card detail, e.g.
 * "Ambient Bed · Rain". Falls back to the raw module id only when the module is unregistered.
 */
export function moduleOutlineLabel(moduleId: string, props: Record<string, unknown>): string {
  const mod = byId.get(moduleId);
  if (!mod) return starterCueBlueprint(props)?.name ?? moduleId;
  const card = mod.summarize(props);
  const detail = card.badge === 'FIX' ? '' : stripLeadingSymbols(card.title);
  return detail && detail !== mod.meta.name ? `${mod.meta.name} · ${detail}` : mod.meta.name;
}
