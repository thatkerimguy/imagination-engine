// Column ↔ record mapping for the SQLite driver: one upsert statement and one row reader per table.
import type { MediaAssetRecord, NodeBodyRecord, NodeLinkRecord, NodeRecord } from '@kn/core';
import type {
  GimmickBlueprintRow,
  GimmickPackRow,
  GrowthLogRow,
  SettingRow,
} from './port.ts';

type Param = string | number | null;
type Row = Record<string, Param>;

interface TableSpec<T> {
  table: string;
  /** Column names in bind order; the first `keyCols` form the primary key. */
  cols: readonly string[];
  keyCols: number;
  bind(r: T): Param[];
  read(row: Row): T;
}

const s = (v: Param | undefined): string => String(v ?? '');
const ns = (v: Param | undefined): string | null => (v === null || v === undefined ? null : String(v));
const n = (v: Param | undefined): number => Number(v ?? 0);

export const NODES: TableSpec<NodeRecord> = {
  table: 'nodes',
  cols: [
    'id',
    'kind',
    'parent_id',
    'book_id',
    'title',
    'subtitle',
    'position',
    'workspace_mode',
    'cover_asset_id',
    'locked',
    'deleted_at',
    'word_count',
    'created_at',
    'updated_at',
    'meta_json',
  ],
  keyCols: 1,
  bind: (r) => [
    r.id,
    r.kind,
    r.parentId,
    r.bookId,
    r.title,
    r.subtitle,
    r.position,
    r.workspaceMode,
    r.coverAssetId,
    r.locked ? 1 : 0,
    r.deletedAt,
    r.wordCount,
    r.createdAt,
    r.updatedAt,
    r.metaJson,
  ],
  read: (x) => ({
    id: s(x.id),
    kind: s(x.kind) as NodeRecord['kind'],
    parentId: ns(x.parent_id),
    bookId: ns(x.book_id),
    title: s(x.title),
    subtitle: ns(x.subtitle),
    position: n(x.position),
    workspaceMode: ns(x.workspace_mode) as NodeRecord['workspaceMode'],
    coverAssetId: ns(x.cover_asset_id),
    locked: n(x.locked) === 1,
    deletedAt: ns(x.deleted_at),
    wordCount: n(x.word_count),
    createdAt: s(x.created_at),
    updatedAt: s(x.updated_at),
    metaJson: ns(x.meta_json),
  }),
};

export const BODIES: TableSpec<NodeBodyRecord> = {
  table: 'node_bodies',
  cols: ['node_id', 'blocks_json', 'plain_text', 'updated_at'],
  keyCols: 1,
  bind: (r) => [r.nodeId, r.blocksJson, r.plainText, r.updatedAt],
  read: (x) => ({
    nodeId: s(x.node_id),
    blocksJson: s(x.blocks_json),
    plainText: s(x.plain_text),
    updatedAt: s(x.updated_at),
  }),
};

export const LINKS: TableSpec<NodeLinkRecord> = {
  table: 'node_links',
  cols: ['source_id', 'target_id', 'relation', 'created_at'],
  keyCols: 3,
  bind: (r) => [r.sourceId, r.targetId, r.relation, r.createdAt],
  read: (x) => ({
    sourceId: s(x.source_id),
    targetId: s(x.target_id),
    relation: s(x.relation) as NodeLinkRecord['relation'],
    createdAt: s(x.created_at),
  }),
};

export const GROWTH: TableSpec<GrowthLogRow> = {
  table: 'growth_logs',
  cols: [
    'id',
    'node_id',
    'book_id',
    'date_key',
    'word_count',
    'chars',
    'sentences',
    'paragraphs',
    'is_baseline',
    'recorded_at',
  ],
  keyCols: 1,
  bind: (r) => [
    r.id,
    r.nodeId,
    r.bookId,
    r.dateKey,
    r.wordCount,
    r.chars,
    r.sentences,
    r.paragraphs,
    r.isBaseline ? 1 : 0,
    r.recordedAt,
  ],
  read: (x) => ({
    id: s(x.id),
    nodeId: s(x.node_id),
    bookId: ns(x.book_id),
    dateKey: s(x.date_key),
    wordCount: n(x.word_count),
    chars: n(x.chars),
    sentences: n(x.sentences),
    paragraphs: n(x.paragraphs),
    isBaseline: n(x.is_baseline) === 1,
    recordedAt: s(x.recorded_at),
  }),
};

export const MEDIA: TableSpec<MediaAssetRecord> = {
  table: 'media_assets',
  cols: ['id', 'kind', 'relative_path', 'mime_type', 'width', 'height', 'bytes', 'created_at'],
  keyCols: 1,
  bind: (r) => [r.id, r.kind, r.relativePath, r.mimeType, r.width, r.height, r.bytes, r.createdAt],
  read: (x) => ({
    id: s(x.id),
    kind: s(x.kind) as MediaAssetRecord['kind'],
    relativePath: s(x.relative_path),
    mimeType: s(x.mime_type),
    width: n(x.width),
    height: n(x.height),
    bytes: n(x.bytes),
    createdAt: s(x.created_at),
  }),
};

export const SETTINGS: TableSpec<SettingRow> = {
  table: 'settings',
  cols: ['key', 'value_json', 'updated_at'],
  keyCols: 1,
  bind: (r) => [r.key, r.valueJson, r.updatedAt],
  read: (x) => ({ key: s(x.key), valueJson: s(x.value_json), updatedAt: s(x.updated_at) }),
};

export const PACKS: TableSpec<GimmickPackRow> = {
  table: 'gimmick_packs',
  cols: ['id', 'genre', 'title', 'version', 'meta_json', 'created_at'],
  keyCols: 1,
  bind: (r) => [r.id, r.genre, r.title, r.version, r.metaJson, r.createdAt],
  read: (x) => ({
    id: s(x.id),
    genre: s(x.genre),
    title: s(x.title),
    version: n(x.version),
    metaJson: ns(x.meta_json),
    createdAt: s(x.created_at),
  }),
};

export const BLUEPRINTS: TableSpec<GimmickBlueprintRow> = {
  table: 'gimmick_blueprints',
  cols: ['id', 'pack_id', 'engine', 'genre', 'title', 'config_json', 'created_at'],
  keyCols: 1,
  bind: (r) => [r.id, r.packId, r.engine, r.genre, r.title, r.configJson, r.createdAt],
  read: (x) => ({
    id: s(x.id),
    packId: s(x.pack_id),
    engine: s(x.engine),
    genre: s(x.genre),
    title: s(x.title),
    configJson: s(x.config_json),
    createdAt: s(x.created_at),
  }),
};

/** `INSERT … ON CONFLICT(pk) DO UPDATE` (an UPDATE, so rowids and FTS rowids stay stable). */
export function upsertSql<T>(spec: TableSpec<T>): string {
  const keys = spec.cols.slice(0, spec.keyCols);
  const rest = spec.cols.slice(spec.keyCols);
  const set = rest.length
    ? `DO UPDATE SET ${rest.map((c) => `${c} = excluded.${c}`).join(', ')}`
    : 'DO NOTHING';
  return `INSERT INTO ${spec.table} (${spec.cols.join(', ')}) VALUES (${spec.cols
    .map(() => '?')
    .join(', ')}) ON CONFLICT(${keys.join(', ')}) ${set}`;
}

/** Table specs in insert order (parents before children) for full loads and restores. */
export const TABLE_ORDER = [
  ['mediaAssets', MEDIA],
  ['nodes', NODES],
  ['nodeBodies', BODIES],
  ['nodeLinks', LINKS],
  ['growthLogs', GROWTH],
  ['settings', SETTINGS],
  ['gimmickPacks', PACKS],
  ['gimmickBlueprints', BLUEPRINTS],
] as const;

export type { Param, Row, TableSpec };
