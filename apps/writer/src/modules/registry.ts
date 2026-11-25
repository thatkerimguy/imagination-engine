// Every gimmick the writer knows about. Only each module's pure barrel is imported — schema,
// meta and formatCardSummary — never renderer.ts (CLAUDE.md §3.3, checked by boundary.test.ts).
import type {
  ModuleCard,
  ModuleCardFormatter,
  ModuleMeta,
  ModuleSchemaDefinition,
  ValidationResult,
} from '@kn/core';
import * as dice from '@kn/module-bl-dice-3d';
import * as lighter from '@kn/module-bl-lighter-flick';
import * as ambient from '@kn/module-core-ambient-bed';
import * as chat from '@kn/module-gits-cyberbrain-chat';
import * as whisper from '@kn/module-gits-ghost-whisper';
import * as gaslight from '@kn/module-pt-gaslight-edit';

type Props = Record<string, unknown>;

/** A module with its prop type erased, so screens can treat every gimmick the same way. */
export interface WriterModule {
  meta: ModuleMeta;
  schema: ModuleSchemaDefinition<Props>;
  /** Card for a block's stored props; falls back gracefully when props are invalid. */
  summarize(props: Props): ModuleCard;
}

function register<P extends object>(
  schema: ModuleSchemaDefinition<P>,
  format: ModuleCardFormatter<P>,
): WriterModule {
  const erased: ModuleSchemaDefinition<Props> = {
    meta: schema.meta,
    fields: schema.fields,
    defaults: schema.defaults as unknown as Props,
    validate: (raw) => schema.validate(raw) as ValidationResult<Props>,
  };
  return {
    meta: schema.meta,
    schema: erased,
    summarize(props) {
      const result = schema.validate(props);
      if (result.ok) return format(result.props);
      return {
        title: `${schema.meta.icon} ${schema.meta.name}`,
        subtitle: result.errors[0] ?? 'Needs attention',
        badge: 'FIX',
      };
    },
  };
}

export const writerModules: readonly WriterModule[] = [
  register(ambient.schema, ambient.formatCardSummary),
  register(chat.schema, chat.formatCardSummary),
  register(dice.schema, dice.formatCardSummary),
  register(gaslight.schema, gaslight.formatCardSummary),
  register(whisper.schema, whisper.formatCardSummary),
  register(lighter.schema, lighter.formatCardSummary),
];

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
  if (!mod) return moduleId;
  const card = mod.summarize(props);
  const detail = card.badge === 'FIX' ? '' : stripLeadingSymbols(card.title);
  return detail && detail !== mod.meta.name ? `${mod.meta.name} · ${detail}` : mod.meta.name;
}
