// 30-day Trash: record shape and pure helpers. @kn/core manifests are frozen, so the soft-delete
// marker (`deletedAt`, ISO-8601 UTC) lives in a writer-only `trash/<id>` record per trashed item.
// Seasons and chapters are also unlinked from their parent's reading order (index remembered),
// so every order-driven consumer (outline, compile, publish, search) skips them for free.
import type { DocumentStore } from './documents.ts';

export const TRASH_RETENTION_DAYS = 30;
export const DAY_MS = 86_400_000;
export const TRASH_PREFIX = 'trash/';
export const trashKey = (id: string): string => `${TRASH_PREFIX}${id}`;

/** The calm undo hint every "Move to Trash" confirmation shows. */
export const TRASH_HINT =
  'You can restore it from Settings › Backup & Restore › Trash for 30 days.';

export type TrashKind = 'novel' | 'season' | 'chapter' | 'folder' | 'doc';

export interface TrashRecord {
  id: string;
  kind: TrashKind;
  title: string;
  /** ISO-8601 UTC instant the item was moved to Trash. */
  deletedAt: string;
  /** Season / chapter: the owning book. */
  novelId?: string;
  /** Chapter: the owning season. */
  seasonId?: string;
  /** Season / chapter: position in the parent's reading order before it was trashed. */
  index?: number;
}

export interface TrashListItem extends TrashRecord {
  daysLeft: number;
}

const KINDS: readonly TrashKind[] = ['novel', 'season', 'chapter', 'folder', 'doc'];

export const TRASH_KIND_LABEL: Readonly<Record<TrashKind, string>> = {
  novel: 'Book',
  season: 'Season',
  chapter: 'Chapter',
  folder: 'Folder',
  doc: 'Note',
};

/** Cleans any stored value into a record, or null when unusable. Pure. */
export function normalizeTrashRecord(v: unknown): TrashRecord | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Record<string, unknown>;
  const kind = KINDS.find((k) => k === s.kind);
  if (!kind || typeof s.id !== 'string' || !s.id) return null;
  if (typeof s.deletedAt !== 'string' || Number.isNaN(Date.parse(s.deletedAt))) return null;
  const r: TrashRecord = {
    id: s.id,
    kind,
    title: typeof s.title === 'string' ? s.title : '',
    deletedAt: s.deletedAt,
  };
  if (typeof s.novelId === 'string') r.novelId = s.novelId;
  if (typeof s.seasonId === 'string') r.seasonId = s.seasonId;
  if (typeof s.index === 'number' && Number.isInteger(s.index) && s.index >= 0) r.index = s.index;
  return r;
}

export const trashAgeMs = (r: Pick<TrashRecord, 'deletedAt'>, now: number): number =>
  now - Date.parse(r.deletedAt);

/** Whole days left before automatic deletion (30 right after trashing, 0 on the last day). */
export const trashDaysLeft = (r: Pick<TrashRecord, 'deletedAt'>, now: number): number =>
  Math.max(0, TRASH_RETENTION_DAYS - Math.floor(Math.max(0, trashAgeMs(r, now)) / DAY_MS));

export const isTrashExpired = (r: Pick<TrashRecord, 'deletedAt'>, now: number): boolean =>
  trashAgeMs(r, now) >= TRASH_RETENTION_DAYS * DAY_MS;

export function deletesInLabel(daysLeft: number): string {
  if (daysLeft <= 0) return 'Deletes today';
  return `Deletes in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`;
}

/** Inserts `id` at `index` (clamped), never duplicating it. Pure. */
export function insertAt(list: readonly string[], id: string, index = list.length): string[] {
  if (list.includes(id)) return [...list];
  const out = [...list];
  out.splice(Math.min(Math.max(0, index), out.length), 0, id);
  return out;
}

interface NoteNode {
  id: string;
  parentFolderId: string | null;
}

/**
 * Folder and note ids hidden from the active workspace: trashed themselves, or inside a trashed
 * folder at any depth. Cycle-safe. Pure.
 */
export function hiddenNoteIds(
  folders: readonly NoteNode[],
  docs: readonly NoteNode[],
  trashed: ReadonlySet<string>,
): Set<string> {
  const parent = new Map(folders.map((f) => [f.id, f.parentFolderId]));
  const memo = new Map<string, boolean>();
  const folderHidden = (id: string): boolean => {
    const seen = new Set<string>();
    let at: string | null | undefined = id;
    while (at && !seen.has(at)) {
      const known = memo.get(at);
      if (known !== undefined) return known;
      if (trashed.has(at)) break;
      seen.add(at);
      at = parent.get(at);
    }
    const hidden = !!at && trashed.has(at);
    for (const s of seen) memo.set(s, hidden);
    return hidden;
  };
  const out = new Set<string>();
  for (const f of folders) if (folderHidden(f.id)) out.add(f.id);
  for (const d of docs)
    if (trashed.has(d.id) || (d.parentFolderId && folderHidden(d.parentFolderId))) out.add(d.id);
  return out;
}

/** True for a `chapter/<novel>/<season>/<chapter>` key whose book, season or self is trashed. */
export function isChapterKeyTrashed(key: string, trashed: ReadonlySet<string>): boolean {
  const [, n, s, c] = key.split('/');
  return [n, s, c].some((id) => !!id && trashed.has(id));
}

/** Ids of every trashed item (cheap: key scan only). */
export async function trashedIds(docs: DocumentStore): Promise<Set<string>> {
  return new Set((await docs.keys(TRASH_PREFIX)).map((k) => k.slice(TRASH_PREFIX.length)));
}
