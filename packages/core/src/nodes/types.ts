// v2 Unified Node Tree: one hierarchical graph for every authored thing (books, seasons,
// chapters, notes workspace folders/notes and story-bible entries), plus explicit backlinks,
// growth history and media assets. Pure types: storage lives in the writer's DatabasePort.

export const NODE_KINDS = [
  'book',
  'season',
  'chapter',
  'folder',
  'note',
  'character',
  'location',
  'lore',
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

/** `prose`: clean distraction-free books. `interactive`: kinetic fiction (gimmicks on show). */
export const WORKSPACE_MODES = ['prose', 'interactive'] as const;
export type WorkspaceMode = (typeof WORKSPACE_MODES)[number];
export const DEFAULT_WORKSPACE_MODE: WorkspaceMode = 'prose';

export interface NodeRecord {
  id: string;
  kind: NodeKind;
  /** Direct parent (`null` = a root: a book, or a top-level notes item). */
  parentId: string | null;
  /** Owning book (`null` for books themselves and the notes workspace). */
  bookId: string | null;
  title: string;
  subtitle: string | null;
  /** Order among siblings (ascending). Kept while trashed, so restore lands in place. */
  position: number;
  /** Books only; `null` elsewhere. */
  workspaceMode: WorkspaceMode | null;
  coverAssetId: string | null;
  locked: boolean;
  /** ISO-8601 UTC instant the node was moved to Trash (`null` = active). */
  deletedAt: string | null;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
  /** Kind-specific extras as JSON (e.g. a book's author, theme and enabled modules). */
  metaJson: string | null;
}

export interface NodeBodyRecord {
  nodeId: string;
  blocksJson: string;
  plainText: string;
  updatedAt: string;
}

export const LINK_RELATIONS = ['mention', 'reference'] as const;
export type LinkRelation = (typeof LINK_RELATIONS)[number];

export interface NodeLinkRecord {
  sourceId: string;
  targetId: string;
  relation: LinkRelation;
  createdAt: string;
}

export interface GrowthLogRecord {
  id: string;
  nodeId: string;
  bookId: string | null;
  /** Local calendar day, `YYYY-MM-DD`. */
  dateKey: string;
  wordCount: number;
  /** A starting count (create / import / restore), not words written. */
  isBaseline: boolean;
  recordedAt: string;
}

export const MEDIA_KINDS = ['cover', 'cover_thumb', 'attachment'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export interface MediaAssetRecord {
  id: string;
  kind: MediaKind;
  /** Relative to the app's document directory (e.g. `covers/<id>.jpg`). */
  relativePath: string;
  mimeType: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
}
