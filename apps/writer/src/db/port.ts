// DatabasePort: the writer's one relational persistence contract (v2). Native builds back it with
// expo-sqlite (WAL, foreign keys, FTS5); Expo Web and Vitest use the in-memory relational engine
// with the same cascade and search semantics. Every write method is atomic.
import type {
  GrowthLogRecord,
  MediaAssetRecord,
  NodeBodyRecord,
  NodeKind,
  NodeLinkRecord,
  NodeRecord,
} from '@kn/core';

/** Writer-side growth row: the core record plus the extra counts the Growth charts plot. */
export interface GrowthLogRow extends GrowthLogRecord {
  chars: number;
  sentences: number;
  paragraphs: number;
}

export interface SettingRow {
  key: string;
  valueJson: string;
  updatedAt: string;
}

/** Gimmick v2 scaffold (OVERHAUL-03/04): rows are stored and exported, nothing reads them yet. */
export interface GimmickPackRow {
  id: string;
  genre: string;
  title: string;
  version: number;
  metaJson: string | null;
  createdAt: string;
}

export interface GimmickBlueprintRow {
  id: string;
  packId: string;
  engine: string;
  genre: string;
  title: string;
  configJson: string;
  createdAt: string;
}

/** Every table as plain rows: the backup format and the restore input. */
export interface DatabaseTables {
  nodes: NodeRecord[];
  nodeBodies: NodeBodyRecord[];
  nodeLinks: NodeLinkRecord[];
  growthLogs: GrowthLogRow[];
  mediaAssets: MediaAssetRecord[];
  settings: SettingRow[];
  gimmickPacks: GimmickPackRow[];
  gimmickBlueprints: GimmickBlueprintRow[];
}

/** One node write: the row, optionally its body, optionally its full set of outgoing links. */
export interface NodeWrite {
  node: NodeRecord;
  body?: NodeBodyRecord;
  /** When present, replaces every outgoing link of `node` (unknown targets are skipped). */
  links?: NodeLinkRecord[];
}

export interface NodeQuery {
  /** Direct children of this parent (`null` = roots). */
  parentId?: string | null;
  bookId?: string;
  kinds?: readonly NodeKind[];
  /** Include rows whose own `deletedAt` is set (default false). Ancestors are not checked. */
  includeDeleted?: boolean;
}

export interface SearchHit {
  nodeId: string;
  /** Lower is better (FTS5 bm25-style). */
  rank: number;
}

export interface IntegrityCounts {
  /** Rows in the search index. */
  ftsRows: number;
  /** Nodes whose own `deletedAt` is null (the search index must hold exactly these). */
  activeNodes: number;
  /** Nodes whose parent row does not exist. */
  brokenParents: number;
  orphanBodies: number;
  orphanLinks: number;
  orphanGrowth: number;
}

export interface DatabasePort {
  readonly driver: 'sqlite' | 'web' | 'memory';
  /** Schema version (`PRAGMA user_version`). */
  readonly schemaVersion: number;

  getNode(id: string): Promise<NodeRecord | null>;
  /** Matching nodes in sibling order (`sortNodes`). */
  listNodes(query?: NodeQuery): Promise<NodeRecord[]>;
  getBody(nodeId: string): Promise<NodeBodyRecord | null>;
  /** Upserts nodes (+ bodies, + outgoing links) and syncs the search index, atomically. */
  putNodes(writes: readonly NodeWrite[]): Promise<void>;
  /** Hard delete. ON DELETE CASCADE removes descendants, bodies, links and growth logs. */
  deleteNodes(ids: readonly string[]): Promise<void>;

  listLinks(query: { sourceId?: string; targetId?: string }): Promise<NodeLinkRecord[]>;

  /** Upsert by id. */
  putGrowthLogs(rows: readonly GrowthLogRow[]): Promise<void>;
  /** Oldest first. */
  listGrowthLogs(query: { nodeId?: string; bookId?: string }): Promise<GrowthLogRow[]>;
  deleteGrowthLogs(ids: readonly string[]): Promise<void>;

  getMediaAsset(id: string): Promise<MediaAssetRecord | null>;
  listMediaAssets(): Promise<MediaAssetRecord[]>;
  putMediaAssets(rows: readonly MediaAssetRecord[]): Promise<void>;
  /** Nodes referencing a deleted asset get `coverAssetId = null`. */
  deleteMediaAssets(ids: readonly string[]): Promise<void>;

  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, valueJson: string): Promise<void>;
  deleteSetting(key: string): Promise<void>;
  /** Keys starting with `prefix`, ascending. */
  listSettingKeys(prefix: string): Promise<string[]>;

  /**
   * Full-text search over active nodes' title + plain text: every term must match, as a token
   * prefix (`tid` → "tide"), or as an exact phrase when the query is in double quotes.
   */
  search(query: string, opts?: { limit?: number }): Promise<SearchHit[]>;
  /** Drops and rebuilds the search index from `nodes` + `node_bodies`. */
  rebuildSearchIndex(): Promise<void>;
  integrity(): Promise<IntegrityCounts>;

  exportTables(): Promise<DatabaseTables>;
  /** Atomically replaces every table with `tables` and rebuilds the search index. */
  replaceAll(tables: DatabaseTables): Promise<void>;
}

export const SCHEMA_USER_VERSION = 2;
export const DATABASE_NAME = 'kinetic-writer-v2.db';

export const emptyTables = (): DatabaseTables => ({
  nodes: [],
  nodeBodies: [],
  nodeLinks: [],
  growthLogs: [],
  mediaAssets: [],
  settings: [],
  gimmickPacks: [],
  gimmickBlueprints: [],
});
