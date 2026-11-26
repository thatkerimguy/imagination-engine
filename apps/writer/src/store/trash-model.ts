// 30-day relational Trash: record shape and pure helpers. Trashing sets `nodes.deleted_at`
// (ISO-8601 UTC) on the item itself and keeps its `position`; every active query skips nodes that
// are trashed or sit under a trashed ancestor, so outline, compile, publish, search and the
// widget skip them for free. Restore clears it; permanent delete lets ON DELETE CASCADE clean up.
import type { NodeKind, NodeRecord } from '@kn/core';

export const TRASH_RETENTION_DAYS = 30;
export const DAY_MS = 86_400_000;

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

export const TRASH_KIND_LABEL: Readonly<Record<TrashKind, string>> = {
  novel: 'Book',
  season: 'Season',
  chapter: 'Chapter',
  folder: 'Folder',
  doc: 'Note',
};

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

const TRASH_KIND_OF: Partial<Record<NodeKind, TrashKind>> = {
  book: 'novel',
  season: 'season',
  chapter: 'chapter',
  folder: 'folder',
  note: 'doc',
  character: 'doc',
  location: 'doc',
  lore: 'doc',
};

/** The Trash record of a trashed node (`null` for active nodes; every story kind is a `doc`). Pure. */
export function trashRecordOf(n: NodeRecord): TrashRecord | null {
  const kind = TRASH_KIND_OF[n.kind];
  if (!kind || !n.deletedAt) return null;
  const r: TrashRecord = { id: n.id, kind, title: n.title, deletedAt: n.deletedAt };
  if ((kind === 'season' || kind === 'chapter') && n.bookId) r.novelId = n.bookId;
  if (kind === 'chapter' && n.parentId) r.seasonId = n.parentId;
  if (kind === 'season' || kind === 'chapter') r.index = n.position;
  return r;
}

/** Ids of nodes that are trashed or sit under a trashed ancestor (cycle-safe). Pure. */
export function hiddenNodeIds(
  nodes: readonly Pick<NodeRecord, 'id' | 'parentId' | 'deletedAt'>[],
): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const memo = new Map<string, boolean>();
  const hidden = (id: string): boolean => {
    const path: string[] = [];
    let at: string | null | undefined = id;
    let result = false;
    while (at && !path.includes(at)) {
      const known = memo.get(at);
      if (known !== undefined) {
        result = known;
        break;
      }
      const n = byId.get(at);
      if (!n) break;
      path.push(at);
      if (n.deletedAt) {
        result = true;
        break;
      }
      at = n.parentId;
    }
    for (const p of path) memo.set(p, result);
    return result;
  };
  return new Set(nodes.filter((n) => hidden(n.id)).map((n) => n.id));
}
