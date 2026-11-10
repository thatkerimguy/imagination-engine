import type { Locale, Translator } from '@ie/i18n';
import {
  ENDINGS_KEY,
  formatValue,
  pickLabel,
  type IconName,
  type ListComponent,
  type Piece,
  type ScreenAction,
  type ScreenComponent,
  type StoryRuntime,
} from '@ie/story';
import { variableLabel } from './labels.ts';
import type { PresentKey } from './messages.ts';

/*
 * A screen's view model (ADR 0018): the visible components with their text rendered and their
 * bound values read. Pure, so it is unit-tested; screens.ts turns it into DOM.
 */

export interface ListRow {
  readonly label: string;
  readonly value?: string;
  readonly note?: string;
  readonly status?: string;
}

export type ViewNode =
  | {
      readonly kind: 'stack';
      readonly id: string;
      readonly direction: 'row' | 'column';
      readonly gap: string;
      readonly align: string;
      readonly children: readonly ViewNode[];
    }
  | {
      readonly kind: 'grid';
      readonly id: string;
      readonly columns: number;
      readonly children: readonly ViewNode[];
    }
  | {
      readonly kind: 'text';
      readonly id: string;
      readonly style: string;
      readonly pieces: readonly Piece[];
    }
  | {
      readonly kind: 'bar';
      readonly id: string;
      readonly label: string;
      readonly value: number;
      readonly max: number;
      /** 0..1 */
      readonly fill: number;
      readonly text: string;
    }
  | { readonly kind: 'icon'; readonly id: string; readonly icon: IconName }
  | {
      readonly kind: 'list';
      readonly id: string;
      readonly rows: readonly ListRow[];
      readonly empty: string;
    }
  | {
      readonly kind: 'button';
      readonly id: string;
      readonly label: string;
      readonly actions: readonly ScreenAction[];
    }
  | {
      readonly kind: 'tabs';
      readonly id: string;
      readonly tabs: readonly {
        readonly id: string;
        readonly label: string;
        readonly children: readonly ViewNode[];
      }[];
    };

export interface ModelContext {
  readonly runtime: StoryRuntime;
  readonly locale: Locale;
  readonly t: Translator<PresentKey>;
  /** False hides Continue (nothing saved yet). */
  readonly canContinue?: boolean;
}

function plain(pieces: readonly Piece[]): string {
  return pieces.map((p) => (p.kind === 'pause' ? '' : p.text)).join('');
}

function listRows(component: ListComponent, ctx: ModelContext): ListRow[] {
  const { runtime, locale, t } = ctx;
  const { project } = runtime.story;
  switch (component.source) {
    case 'inventory':
      return (project.items ?? []).flatMap((item) => {
        const count = runtime.inventory[item.id] ?? 0;
        if (count <= 0) return [];
        const note = pickLabel(item.description, locale);
        return [
          {
            label: pickLabel(item.name, locale, item.id),
            value: formatValue(count, locale),
            ...(note ? { note } : {}),
          },
        ];
      });
    case 'quests': {
      const order = { active: 0, done: 1, failed: 2 } as const;
      return (project.quests ?? [])
        .flatMap((quest) => {
          const state = runtime.quests[quest.id];
          return state ? [{ quest, state }] : [];
        })
        .sort((a, b) => order[a.state.status] - order[b.state.status])
        .map(({ quest, state }) => {
          const label = pickLabel(quest.name, locale, quest.id);
          if (state.status === 'active')
            return {
              label,
              note: pickLabel(quest.steps[state.step]?.text, locale),
              status: 'active',
            };
          return {
            label,
            value: t(state.status === 'done' ? 'screen.questDone' : 'screen.questFailed'),
            status: state.status,
          };
        });
    }
    case 'stats':
      return project.variables
        .filter((v) => v.stat)
        .map((v) => ({
          label: variableLabel(runtime.story, v.id, locale),
          value: formatValue(runtime.value(v.id), locale),
        }));
    case 'variable': {
      const value = component.var ? runtime.value(component.var) : null;
      return Array.isArray(value) ? value.map((v) => ({ label: formatValue(v, locale) })) : [];
    }
    case 'endings': {
      const reached = runtime.persistentValues[ENDINGS_KEY];
      const ids = new Set(Array.isArray(reached) ? reached.map(String) : []);
      const rows: ListRow[] = [];
      for (const info of runtime.story.blocks.values()) {
        const block = info.block;
        if (block.type !== 'end' || !block.ending) continue;
        const seen = ids.has(block.ending.id);
        rows.push({
          label: seen
            ? plain(runtime.render(block.ending.title, locale))
            : t('screen.lockedEnding'),
          status: seen ? 'done' : 'locked',
        });
      }
      return rows;
    }
  }
}

function barMax(component: Extract<ScreenComponent, { type: 'bar' }>, runtime: StoryRuntime) {
  if (component.maxVar) {
    const value = runtime.value(component.maxVar);
    if (typeof value === 'number' && value > 0) return value;
  }
  if (component.max) return component.max;
  const own = runtime.story.variables.get(component.var)?.max;
  return own && own > 0 ? own : 100;
}

/** The visible view of a component list, or an empty list. */
export function screenModel(components: readonly ScreenComponent[], ctx: ModelContext): ViewNode[] {
  const { runtime, locale } = ctx;
  const text = (value: Parameters<StoryRuntime['render']>[0]) => runtime.render(value, locale);
  const nodes: ViewNode[] = [];
  for (const c of components) {
    if (c.if !== undefined && !runtime.holds(c.if)) continue;
    switch (c.type) {
      case 'stack':
        nodes.push({
          kind: 'stack',
          id: c.id,
          direction: c.direction ?? 'column',
          gap: c.gap ?? 'medium',
          align: c.align ?? 'stretch',
          children: screenModel(c.children, ctx),
        });
        break;
      case 'grid':
        nodes.push({
          kind: 'grid',
          id: c.id,
          columns: c.columns,
          children: screenModel(c.children, ctx),
        });
        break;
      case 'text':
        nodes.push({ kind: 'text', id: c.id, style: c.style ?? 'body', pieces: text(c.text) });
        break;
      case 'bar': {
        const raw = runtime.value(c.var);
        const value = typeof raw === 'number' ? raw : 0;
        const max = barMax(c, runtime);
        const label = c.label ? plain(text(c.label)) : variableLabel(runtime.story, c.var, locale);
        nodes.push({
          kind: 'bar',
          id: c.id,
          label,
          value,
          max,
          fill: Math.max(0, Math.min(1, value / max)),
          text: `${formatValue(value, locale)} / ${formatValue(max, locale)}`,
        });
        break;
      }
      case 'icon':
        nodes.push({ kind: 'icon', id: c.id, icon: c.icon });
        break;
      case 'list':
        nodes.push({
          kind: 'list',
          id: c.id,
          rows: listRows(c, ctx),
          empty: c.empty ? plain(text(c.empty)) : ctx.t('screen.empty'),
        });
        break;
      case 'button':
        if (c.actions.some((a) => a.type === 'continue') && ctx.canContinue === false) break;
        nodes.push({ kind: 'button', id: c.id, label: plain(text(c.label)), actions: c.actions });
        break;
      case 'tabs':
        nodes.push({
          kind: 'tabs',
          id: c.id,
          tabs: c.tabs.map((tab) => ({
            id: tab.id,
            label: plain(text(tab.label)),
            children: screenModel(tab.children, ctx),
          })),
        });
        break;
    }
  }
  return nodes;
}
