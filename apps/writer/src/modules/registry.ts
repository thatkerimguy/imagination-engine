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
import * as ambient from '@kn/module-core-ambient-bed';
import * as chat from '@kn/module-gits-cyberbrain-chat';

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
];

const byId = new Map(writerModules.map((m) => [m.meta.id, m]));

export const getWriterModule = (id: string): WriterModule | undefined => byId.get(id);

/** Modules a novel may insert, in registry order. Unknown ids in the manifest are ignored. */
export const enabledWriterModules = (enabled: readonly string[]): WriterModule[] =>
  writerModules.filter((m) => enabled.includes(m.meta.id));
