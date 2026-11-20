// Writer-only item metadata (`meta/item/<id>`) shared by novels, chapters, folders and notes:
// tags, colour rail, pin, lock, cover art, synopsis, word goal, manual order, last opened.
// Plus one sort helper every list uses (pinned items always float first).
import type { NovelRepository } from './repository.ts';

export interface ItemMeta {
  tags: string[];
  color?: string;
  pinned?: boolean;
  locked?: boolean;
  coverUri?: string;
  synopsis?: string;
  wordGoal?: number;
  manualOrder?: number;
  lastOpenedAt?: number;
}

export type ItemKind = 'novel' | 'chapter' | 'folder' | 'doc';

export const itemMetaKey = (id: string): string => `meta/item/${id}`;

/** The eight editorial colour-rail tones (hex, readable on every Folio theme). */
export const RAIL_COLORS = [
  '#2f7d74',
  '#3d6fb4',
  '#7a5bb0',
  '#b0527a',
  '#c0563b',
  '#c68a2e',
  '#6f8a3a',
  '#6b7280',
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

/** Normalizes a tag: trimmed, lowercase, no leading `#`, inner spaces → `-`. */
export function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-').slice(0, 40);
}

/** Cleans any stored value into a valid ItemMeta. Pure. */
export function normalizeItemMeta(v: unknown): ItemMeta {
  const s = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const tags = Array.isArray(s.tags)
    ? [...new Set(s.tags.filter((t): t is string => typeof t === 'string').map(normalizeTag))]
    : [];
  const out: ItemMeta = { tags: tags.filter(Boolean) };
  if (typeof s.color === 'string' && HEX.test(s.color)) out.color = s.color;
  if (s.pinned === true) out.pinned = true;
  if (s.locked === true) out.locked = true;
  if (typeof s.coverUri === 'string' && s.coverUri) out.coverUri = s.coverUri;
  if (typeof s.synopsis === 'string' && s.synopsis.trim()) out.synopsis = s.synopsis;
  const goal = num(s.wordGoal);
  if (goal !== undefined && goal > 0) out.wordGoal = Math.round(goal);
  const order = num(s.manualOrder);
  if (order !== undefined) out.manualOrder = order;
  const opened = num(s.lastOpenedAt);
  if (opened !== undefined) out.lastOpenedAt = opened;
  return out;
}

export async function loadItemMeta(repo: NovelRepository, id: string): Promise<ItemMeta> {
  return normalizeItemMeta((await repo.docs.read<unknown>(itemMetaKey(id)))?.data);
}

/** Every stored item meta, keyed by item id. */
export async function loadAllItemMeta(repo: NovelRepository): Promise<Map<string, ItemMeta>> {
  const out = new Map<string, ItemMeta>();
  for (const k of await repo.docs.keys('meta/item/')) {
    out.set(k.slice('meta/item/'.length), normalizeItemMeta((await repo.docs.read(k))?.data));
  }
  return out;
}

/** Merges `patch` (an `undefined` value clears that field) and saves. */
export async function updateItemMeta(
  repo: NovelRepository,
  id: string,
  patch: { [K in keyof ItemMeta]?: ItemMeta[K] | undefined },
  opts: { silent?: boolean } = {},
): Promise<ItemMeta> {
  const current: Record<string, unknown> = { ...(await loadItemMeta(repo, id)) };
  const merged = Object.fromEntries(
    Object.entries({ ...current, ...patch }).filter(([, v]) => v !== undefined),
  );
  const next = normalizeItemMeta(merged);
  const empty = next.tags.length === 0 && Object.keys(next).length === 1;
  if (empty) await repo.docs.remove(itemMetaKey(id));
  else await repo.docs.write(itemMetaKey(id), next);
  if (!opts.silent) repo.notifyChanged();
  return next;
}

/** Records that an item was just opened (for the Recent strip). Silent: no list reloads. */
export function touchOpened(repo: NovelRepository, id: string, now = Date.now()) {
  return updateItemMeta(repo, id, { lastOpenedAt: now }, { silent: true });
}

// ── Sorting ───────────────────────────────────────────────────────────────────────────────

export type SortMode =
  'manual' | 'date-edited' | 'date-created' | 'name-asc' | 'type' | 'word-count';

export const SORT_LABELS: Readonly<Record<SortMode, string>> = {
  manual: 'Manual',
  'date-edited': 'Date Edited',
  'date-created': 'Date Created',
  'name-asc': 'Name A–Z',
  type: 'Type',
  'word-count': 'Word Count',
};

export interface SortableItem {
  id: string;
  kind: ItemKind;
  title: string;
  updatedAt: number;
  createdAt?: number;
  words?: number;
}

const KIND_ORDER: Readonly<Record<ItemKind, number>> = { folder: 0, novel: 1, chapter: 2, doc: 3 };

/**
 * Sorts a copy of `items`. Pinned items always come first; within each group the mode decides,
 * with name as a stable tie-break. Pure.
 */
export function sortItems<T extends SortableItem>(
  items: readonly T[],
  mode: SortMode,
  meta: ReadonlyMap<string, ItemMeta>,
): T[] {
  const name = (a: T, b: T): number =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true });
  const by: Record<SortMode, (a: T, b: T) => number> = {
    manual: (a, b) =>
      (meta.get(a.id)?.manualOrder ?? Number.MAX_SAFE_INTEGER) -
      (meta.get(b.id)?.manualOrder ?? Number.MAX_SAFE_INTEGER),
    'date-edited': (a, b) => b.updatedAt - a.updatedAt,
    'date-created': (a, b) => (b.createdAt ?? b.updatedAt) - (a.createdAt ?? a.updatedAt),
    'name-asc': () => 0,
    type: (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
    'word-count': (a, b) => (b.words ?? 0) - (a.words ?? 0),
  };
  const pin = (x: T): number => (meta.get(x.id)?.pinned ? 0 : 1);
  return [...items].sort((a, b) => pin(a) - pin(b) || by[mode](a, b) || name(a, b));
}

/** Writes `manualOrder` 0..n-1 for ids in the given order (one notification). */
export async function saveManualOrder(repo: NovelRepository, ids: readonly string[]) {
  for (const [i, id] of ids.entries())
    await updateItemMeta(repo, id, { manualOrder: i }, { silent: true });
  repo.notifyChanged();
}
