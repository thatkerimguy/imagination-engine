import { createId } from '@ie/core';
import { z } from 'zod';
import { enemySchema, type EnemyDef } from './fight.ts';
import { materialSchema, type MaterialDef } from './material.ts';
import type { StoryProject } from './project.ts';
import { screenSchema, type ScreenDef } from './screens.ts';
import { sequenceSchema, type SequenceDef } from './sequence.ts';
import { themeSchema, type StoryTheme } from './theme.ts';

/*
 * The Library and packs (ADR 0021): reusable pieces of a novel kept outside any project, and the
 * file they travel in. Pure data and copies; the Studio stores items through @ie/core storage.
 */

export const LIBRARY_KINDS = [
  'effect',
  'sequence',
  'material',
  'enemy',
  'theme',
  'screen',
] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

/** A stage or sound Action block worth keeping: its action and tuned parameters. */
export interface LibraryEffect {
  readonly action: string;
  readonly params?: Readonly<Record<string, unknown>>;
}
export const libraryEffectSchema = z.object({
  action: z.string().regex(/^(stage|audio)(\.[a-z][a-zA-Z0-9]*)+$/),
  params: z.record(z.string(), z.json()).optional(),
});

interface ItemBase {
  readonly id: string;
  /** The author's own name for it; never shown to readers. */
  readonly name: string;
  readonly addedAt: number;
}
export type LibraryItem = ItemBase &
  (
    | { readonly kind: 'effect'; readonly data: LibraryEffect }
    | { readonly kind: 'sequence'; readonly data: SequenceDef }
    | { readonly kind: 'material'; readonly data: MaterialDef }
    | { readonly kind: 'enemy'; readonly data: EnemyDef }
    | { readonly kind: 'theme'; readonly data: StoryTheme }
    | { readonly kind: 'screen'; readonly data: ScreenDef }
  );
/** What an item holds, before it has an ID and a date. */
export type LibraryContent = LibraryItem extends infer I
  ? I extends LibraryItem
    ? Pick<I, 'kind' | 'data'>
    : never
  : never;

const base = {
  id: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/),
  name: z.string().min(1).max(80),
  addedAt: z.number(),
};
export const libraryItemSchema: z.ZodType<LibraryItem> = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('effect'), data: libraryEffectSchema }),
  z.object({ ...base, kind: z.literal('sequence'), data: sequenceSchema }),
  z.object({ ...base, kind: z.literal('material'), data: materialSchema }),
  z.object({ ...base, kind: z.literal('enemy'), data: enemySchema }),
  z.object({ ...base, kind: z.literal('theme'), data: themeSchema }),
  z.object({ ...base, kind: z.literal('screen'), data: screenSchema }),
]);

export const PACK_FORMAT = 'imagination.pack';
export const PACK_VERSION = 1;
export const PACK_LIMIT = 500;

export interface LibraryPack {
  readonly format: typeof PACK_FORMAT;
  readonly version: typeof PACK_VERSION;
  readonly name: string;
  readonly items: readonly LibraryItem[];
}
export const libraryPackSchema = z.object({
  format: z.literal(PACK_FORMAT),
  version: z.literal(PACK_VERSION),
  name: z.string().max(80),
  items: z.array(libraryItemSchema).max(PACK_LIMIT),
});

/** A new Library item holding a copy of `content`. */
export function libraryItem(content: LibraryContent, name: string, now = Date.now()): LibraryItem {
  const data = structuredClone(content.data);
  const label = name.trim().slice(0, 80) || content.kind;
  return {
    id: createId('lib'),
    name: label,
    addedAt: now,
    kind: content.kind,
    data,
  } as LibraryItem;
}

export function makePack(name: string, items: readonly LibraryItem[]): LibraryPack {
  return { format: PACK_FORMAT, version: PACK_VERSION, name: name.trim().slice(0, 80), items };
}

/**
 * Reads a pack file. Throws `not-json`, or the schema's message when the file isn't a valid pack,
 * so nothing half-read ever reaches the Library.
 */
export function parsePack(text: string): LibraryPack {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('not-json');
  }
  const parsed = libraryPackSchema.safeParse(json);
  if (!parsed.success) throw new Error(z.prettifyError(parsed.error));
  return parsed.data;
}

/** A pack's items as new Library items: fresh IDs, so importing a pack twice never overwrites. */
export function itemsFromPack(pack: LibraryPack, now = Date.now()): LibraryItem[] {
  return pack.items.map((item) => ({ ...item, id: createId('lib'), addedAt: now }));
}

const TEXT_KEYS = new Set(['en', 'tr']);

/**
 * A copy of `data` in which everything it defines has a fresh ID, and its own references to those
 * IDs follow (a material's links to its nodes). References to things outside it stay as they are.
 */
export function withFreshIds<T>(data: T): T {
  const ids = new Map<string, string>();
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(collect);
    if (value === null || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'id' && typeof child === 'string' && !ids.has(child)) {
        const cut = child.lastIndexOf('_');
        ids.set(child, createId(cut > 0 ? child.slice(0, cut).replace(/_/g, '') || 'x' : 'x'));
      } else collect(child);
    }
  };
  const copy = (value: unknown, key: string): unknown => {
    if (typeof value === 'string') return TEXT_KEYS.has(key) ? value : (ids.get(value) ?? value);
    if (Array.isArray(value)) return value.map((child) => copy(child, key));
    if (value === null || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([k, child]) => [k, copy(child, k)]));
  };
  collect(data);
  return copy(data, '') as T;
}

export interface AddOptions {
  /** The passage an effect's Action block is added to (the one open in Write). */
  readonly passage?: string;
}

/** Why an item couldn't be added: the project's list of that kind is full, or there is no passage. */
export type AddProblem = 'full' | 'no-passage';

const ROOM = { sequence: 100, material: 60, screen: 40 } as const;

/**
 * Copies a Library item into a project under fresh IDs. An effect becomes an Action block at the
 * end of `options.passage`; a theme replaces the project's theme. Returns the new project, or why
 * it couldn't be done.
 */
export function addToProject(
  project: StoryProject,
  item: LibraryItem,
  options: AddOptions = {},
): StoryProject | AddProblem {
  switch (item.kind) {
    case 'theme':
      return { ...project, theme: structuredClone(item.data) };
    case 'enemy':
      return { ...project, enemies: [...(project.enemies ?? []), withFreshIds(item.data)] };
    case 'sequence':
      if ((project.sequences?.length ?? 0) >= ROOM.sequence) return 'full';
      return { ...project, sequences: [...(project.sequences ?? []), withFreshIds(item.data)] };
    case 'material':
      if ((project.materials?.length ?? 0) >= ROOM.material) return 'full';
      return { ...project, materials: [...(project.materials ?? []), withFreshIds(item.data)] };
    case 'screen':
      if ((project.screens?.length ?? 0) >= ROOM.screen) return 'full';
      return { ...project, screens: [...(project.screens ?? []), withFreshIds(item.data)] };
    case 'effect': {
      let found = false;
      const block = {
        id: createId('b'),
        type: 'action' as const,
        action: item.data.action,
        ...(item.data.params ? { params: structuredClone(item.data.params) } : {}),
      };
      const chapters = project.chapters.map((chapter) => ({
        ...chapter,
        passages: chapter.passages.map((passage) => {
          if (passage.id !== options.passage) return passage;
          found = true;
          return { ...passage, blocks: [...passage.blocks, block] };
        }),
      }));
      return found ? { ...project, chapters } : 'no-passage';
    }
  }
}
