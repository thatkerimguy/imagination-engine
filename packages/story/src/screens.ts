import { z } from 'zod';
import type { Formula, Label, LocalText } from './schema.ts';

/*
 * Screens (ADR 0018): title screens, HUDs and panels built from a small component tree. Kept free
 * of run-time imports from schema.ts, like rpg.ts, so the two never form an import cycle.
 */

const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'IDs use letters, digits and _');
/** A reference; empty means not chosen yet (see refSchema in schema.ts). */
const ref = z.union([id, z.literal('')]);
const label = z.object({ en: z.string().optional(), tr: z.string().optional() });
const localText = z.object({ id, en: z.string().optional(), tr: z.string().optional() });
const formula = z.union([z.string(), z.number(), z.boolean()]);

export const SCREEN_KINDS = ['title', 'hud', 'panel'] as const;
export type ScreenKind = (typeof SCREEN_KINDS)[number];

export const COMPONENT_TYPES = [
  'stack',
  'grid',
  'text',
  'bar',
  'icon',
  'list',
  'button',
  'tabs',
] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const ICONS = [
  'heart',
  'coin',
  'star',
  'key',
  'clock',
  'book',
  'search',
  'message',
  'map',
  'bolt',
] as const;
export type IconName = (typeof ICONS)[number];

export const GAPS = ['none', 'small', 'medium', 'large'] as const;
export const ALIGNS = ['start', 'center', 'end', 'stretch'] as const;
export const TEXT_STYLES = ['title', 'heading', 'body', 'caption'] as const;
/**
 * Where a list's rows come from. `variable` reads a List variable, `stats` the sheet's stats, and
 * `endings` the endings this reader has reached on this device (an endings gallery).
 */
export const LIST_SOURCES = ['inventory', 'quests', 'stats', 'variable', 'endings'] as const;
export const PLAYER_PANELS = ['settings', 'saves', 'history', 'sheet'] as const;
export const SET_ACTION_OPS = ['set', 'add', 'subtract', 'toggle', 'append', 'remove'] as const;

export type ScreenAction =
  | { readonly type: 'start' }
  | { readonly type: 'continue' }
  | { readonly type: 'open'; readonly screen: string }
  | { readonly type: 'close' }
  | { readonly type: 'menu'; readonly panel: (typeof PLAYER_PANELS)[number] }
  | {
      readonly type: 'set';
      readonly var: string;
      readonly op?: (typeof SET_ACTION_OPS)[number];
      readonly value?: Formula;
    };
export const SCREEN_ACTIONS = ['start', 'continue', 'open', 'close', 'menu', 'set'] as const;

export const screenActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('continue') }),
  z.object({ type: z.literal('open'), screen: ref }),
  z.object({ type: z.literal('close') }),
  z.object({ type: z.literal('menu'), panel: z.enum(PLAYER_PANELS) }),
  z.object({
    type: z.literal('set'),
    var: ref,
    op: z.enum(SET_ACTION_OPS).optional(),
    value: formula.optional(),
  }),
]);

interface ComponentBase {
  readonly id: string;
  /** Shown only while this formula is true. */
  readonly if?: Formula;
}
export interface StackComponent extends ComponentBase {
  readonly type: 'stack';
  readonly direction?: 'row' | 'column';
  readonly gap?: (typeof GAPS)[number];
  readonly align?: (typeof ALIGNS)[number];
  readonly children: readonly ScreenComponent[];
}
export interface GridComponent extends ComponentBase {
  readonly type: 'grid';
  readonly columns: number;
  readonly children: readonly ScreenComponent[];
}
export interface TextComponent extends ComponentBase {
  readonly type: 'text';
  readonly text: LocalText;
  readonly style?: (typeof TEXT_STYLES)[number];
}
export interface BarComponent extends ComponentBase {
  readonly type: 'bar';
  readonly var: string;
  /** The full bar: a number variable, else `max`, else the variable's own maximum, else 100. */
  readonly maxVar?: string;
  readonly max?: number;
  readonly label?: LocalText;
}
export interface IconComponent extends ComponentBase {
  readonly type: 'icon';
  readonly icon: IconName;
}
export interface ListComponent extends ComponentBase {
  readonly type: 'list';
  readonly source: (typeof LIST_SOURCES)[number];
  readonly var?: string;
  /** Shown when the list has no rows. */
  readonly empty?: LocalText;
}
export interface ButtonComponent extends ComponentBase {
  readonly type: 'button';
  readonly label: LocalText;
  readonly actions: readonly ScreenAction[];
}
export interface TabsComponent extends ComponentBase {
  readonly type: 'tabs';
  readonly tabs: readonly {
    readonly id: string;
    readonly label: LocalText;
    readonly children: readonly ScreenComponent[];
  }[];
}
export type ScreenComponent =
  | StackComponent
  | GridComponent
  | TextComponent
  | BarComponent
  | IconComponent
  | ListComponent
  | ButtonComponent
  | TabsComponent;

export interface ScreenDef {
  readonly id: string;
  readonly name: Label;
  readonly kind: ScreenKind;
  /** A HUD's edge of the page. */
  readonly edge?: 'top' | 'bottom';
  readonly children: readonly ScreenComponent[];
}

const base = { id, if: formula.optional() };
const children = (): z.ZodType<readonly ScreenComponent[]> => z.array(componentSchema).max(40);

export const componentSchema: z.ZodType<ScreenComponent> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      ...base,
      type: z.literal('stack'),
      direction: z.enum(['row', 'column']).optional(),
      gap: z.enum(GAPS).optional(),
      align: z.enum(ALIGNS).optional(),
      children: children(),
    }),
    z.object({
      ...base,
      type: z.literal('grid'),
      columns: z.number().int().min(1).max(4),
      children: children(),
    }),
    z.object({
      ...base,
      type: z.literal('text'),
      text: localText,
      style: z.enum(TEXT_STYLES).optional(),
    }),
    z.object({
      ...base,
      type: z.literal('bar'),
      var: ref,
      maxVar: id.optional(),
      max: z.number().positive().optional(),
      label: localText.optional(),
    }),
    z.object({ ...base, type: z.literal('icon'), icon: z.enum(ICONS) }),
    z.object({
      ...base,
      type: z.literal('list'),
      source: z.enum(LIST_SOURCES),
      var: ref.optional(),
      empty: localText.optional(),
    }),
    z.object({
      ...base,
      type: z.literal('button'),
      label: localText,
      actions: z.array(screenActionSchema).max(8),
    }),
    z.object({
      ...base,
      type: z.literal('tabs'),
      tabs: z
        .array(z.object({ id, label: localText, children: children() }))
        .min(1)
        .max(6),
    }),
  ]),
);

export const screenSchema = z.object({
  id,
  name: label,
  kind: z.enum(SCREEN_KINDS),
  edge: z.enum(['top', 'bottom']).optional(),
  children: children(),
});

/** Every component in a screen, depth first, with the list it sits in. */
export function walkComponents(
  list: readonly ScreenComponent[],
  visit: (component: ScreenComponent) => void,
): void {
  for (const component of list) {
    visit(component);
    if (component.type === 'stack' || component.type === 'grid')
      walkComponents(component.children, visit);
    else if (component.type === 'tabs')
      for (const tab of component.tabs) walkComponents(tab.children, visit);
  }
}
