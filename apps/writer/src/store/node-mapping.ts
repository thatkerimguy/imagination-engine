// Pure mapping between v1 @kn/core documents (what the editor, export and publish speak) and v2
// relational node rows. Kind-specific fields ride in `metaJson`; reading order is `position`.
import {
  extractPlainText,
  SCHEMA_VERSION,
  type Block,
  type ChapterDocument,
  type NodeBodyRecord,
  type NodeRecord,
  type NovelManifest,
  type SeasonManifest,
  type WorkspaceMode,
} from '@kn/core';
import { stripInlineMarkup } from '../editor/inline-markup.ts';
import { chapterWords } from './word-count.ts';

export const iso = (ms: number): string => new Date(ms).toISOString();
export const ms = (isoString: string): number => Date.parse(isoString) || 0;

type BookMeta = Pick<NovelManifest, 'author' | 'sectionLabel' | 'theme' | 'enabledModules'>;
type SeasonMeta = Pick<SeasonManifest, 'accentColor'>;
type ChapterMeta = Pick<ChapterDocument, 'status'>;

function parseMeta<T extends object>(json: string | null): Partial<T> {
  try {
    const v: unknown = json ? JSON.parse(json) : {};
    return v && typeof v === 'object' ? (v as Partial<T>) : {};
  } catch {
    return {};
  }
}

const base = (now: string, existing: NodeRecord | null) => ({
  subtitle: null,
  workspaceMode: null,
  coverAssetId: existing?.coverAssetId ?? null,
  locked: existing?.locked ?? false,
  deletedAt: existing?.deletedAt ?? null,
  wordCount: existing?.wordCount ?? 0,
  createdAt: existing?.createdAt ?? now,
  updatedAt: now,
});

export function bookNode(
  n: NovelManifest,
  existing: NodeRecord | null,
  now: string,
  mode?: WorkspaceMode,
): NodeRecord {
  const meta: BookMeta = {
    author: n.author,
    sectionLabel: n.sectionLabel,
    theme: n.theme,
    enabledModules: n.enabledModules,
  };
  return {
    ...base(now, existing),
    id: n.id,
    kind: 'book',
    parentId: null,
    bookId: null,
    title: n.title,
    subtitle: n.subtitle ?? null,
    position: existing?.position ?? 0,
    workspaceMode: mode ?? existing?.workspaceMode ?? 'prose',
    metaJson: JSON.stringify(meta),
  };
}

export function toManifest(node: NodeRecord, seasonIds: string[]): NovelManifest {
  const m = parseMeta<BookMeta>(node.metaJson);
  return {
    schemaVersion: SCHEMA_VERSION,
    id: node.id,
    title: node.title,
    ...(node.subtitle ? { subtitle: node.subtitle } : {}),
    author: m.author ?? '',
    sectionLabel: m.sectionLabel ?? 'Season',
    theme: m.theme ?? {},
    enabledModules: m.enabledModules ?? [],
    seasons: seasonIds,
  };
}

export function seasonNode(
  s: SeasonManifest,
  bookId: string,
  existing: NodeRecord | null,
  position: number,
  now: string,
): NodeRecord {
  const meta: SeasonMeta = s.accentColor ? { accentColor: s.accentColor } : {};
  return {
    ...base(now, existing),
    id: s.id,
    kind: 'season',
    parentId: bookId,
    bookId,
    title: s.title,
    subtitle: s.subtitle ?? null,
    position,
    metaJson: JSON.stringify(meta),
  };
}

export function toSeason(node: NodeRecord, chapterIds: string[]): SeasonManifest {
  const m = parseMeta<SeasonMeta>(node.metaJson);
  return {
    id: node.id,
    title: node.title,
    ...(node.subtitle ? { subtitle: node.subtitle } : {}),
    ...(m.accentColor ? { accentColor: m.accentColor } : {}),
    chapters: chapterIds,
  };
}

/** Searchable plain text of any block list (writer markup stripped). */
export const plainTextOf = (blocks: readonly Block[]): string =>
  extractPlainText(blocks, stripInlineMarkup);

export function chapterNode(
  c: ChapterDocument,
  bookId: string,
  existing: NodeRecord | null,
  position: number,
  now: string,
): { node: NodeRecord; body: NodeBodyRecord } {
  const meta: ChapterMeta = { status: c.status };
  const node: NodeRecord = {
    ...base(now, existing),
    id: c.id,
    kind: 'chapter',
    parentId: c.seasonId,
    bookId,
    title: c.title,
    position,
    wordCount: chapterWords(c),
    metaJson: JSON.stringify(meta),
  };
  const body = {
    nodeId: c.id,
    blocksJson: JSON.stringify(c.blocks),
    plainText: plainTextOf(c.blocks),
    updatedAt: now,
  };
  return { node, body };
}

export function parseBlocks<T = Block>(body: NodeBodyRecord | null): T[] {
  try {
    const v: unknown = body ? JSON.parse(body.blocksJson) : [];
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

export function toChapter(node: NodeRecord, body: NodeBodyRecord | null): ChapterDocument {
  const m = parseMeta<ChapterMeta>(node.metaJson);
  return {
    id: node.id,
    seasonId: node.parentId ?? '',
    title: node.title,
    status: m.status ?? 'draft',
    blocks: parseBlocks(body),
  };
}

export const kindMeta = parseMeta;
