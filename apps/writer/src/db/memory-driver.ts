// The in-memory relational engine: the exact DatabasePort semantics of the SQLite schema
// (foreign keys, ON DELETE CASCADE / SET NULL, FTS sync on every write) without a native
// module. Used directly by Vitest, persisted by the web driver, and mirrored by the native
// SQLite driver as its read cache.
import { sortNodes, type MediaAssetRecord, type NodeLinkRecord, type NodeRecord } from '@kn/core';
import { CatalogIndex, mergeCatalog } from './catalog-index.ts';
import { copy, ForeignKeyError, MemoryStore } from './memory-store.ts';
import {
  SCHEMA_USER_VERSION,
  type CatalogQuery,
  type DatabasePort,
  type GimmickBlueprintRow,
  type GimmickPackRow,
  type DatabaseTables,
  type GrowthLogRow,
  type NodeQuery,
  type NodeWrite,
} from './port.ts';
import { linkKey, orderForInsert } from './rows.ts';

export { ForeignKeyError } from './memory-store.ts';

type Table = keyof DatabaseTables;
const ALL_TABLES: readonly Table[] = [
  'nodes',
  'nodeBodies',
  'nodeLinks',
  'growthLogs',
  'mediaAssets',
  'settings',
  'gimmickPacks',
  'gimmickBlueprints',
];

const matches = <T>(row: T, q: Partial<T>): boolean =>
  (Object.keys(q) as (keyof T)[]).every((k) => q[k] === undefined || row[k] === q[k]);

export class MemoryDatabase implements DatabasePort {
  readonly driver: DatabasePort['driver'];
  readonly schemaVersion = SCHEMA_USER_VERSION;
  private readonly s = new MemoryStore();
  private readonly catalog = new CatalogIndex();
  /** Called after every committed write with the tables it touched (web persistence). */
  onCommit: ((tables: ReadonlySet<Table>) => void) | null = null;

  constructor(driver: DatabasePort['driver'] = 'memory', seed?: DatabaseTables) {
    this.driver = driver;
    if (seed) this.s.load(seed);
  }

  private commit(...tables: Table[]): void {
    this.onCommit?.(new Set(tables));
  }

  /** Validates a batch exactly as the SQLite foreign keys would, without writing. */
  checkNodeWrites(writes: readonly NodeWrite[]): void {
    const pending = new Set(writes.map((w) => w.node.id));
    for (const { node } of writes) {
      const p = node.parentId;
      if (p && !this.s.nodes.has(p) && !pending.has(p))
        throw new ForeignKeyError(`parent of ${node.id}`);
      const b = node.bookId;
      if (b && !this.s.nodes.has(b) && !pending.has(b))
        throw new ForeignKeyError(`book of ${node.id}`);
      if (node.coverAssetId && !this.s.media.has(node.coverAssetId))
        throw new ForeignKeyError(`cover of ${node.id}`);
    }
  }

  hasNode(id: string): boolean {
    return this.s.nodes.has(id);
  }

  async getNode(id: string): Promise<NodeRecord | null> {
    const n = this.s.nodes.get(id);
    return n ? copy(n) : null;
  }

  async listNodes(q: NodeQuery = {}): Promise<NodeRecord[]> {
    const out: NodeRecord[] = [];
    for (const n of this.s.nodes.values()) {
      if (q.parentId !== undefined && n.parentId !== q.parentId) continue;
      if (q.bookId !== undefined && n.bookId !== q.bookId) continue;
      if (q.kinds && !q.kinds.includes(n.kind)) continue;
      if (!q.includeDeleted && n.deletedAt) continue;
      out.push(copy(n));
    }
    return sortNodes(out);
  }

  async getBody(nodeId: string) {
    const b = this.s.bodies.get(nodeId);
    return b ? copy(b) : null;
  }

  async putNodes(writes: readonly NodeWrite[]): Promise<void> {
    this.checkNodeWrites(writes);
    const byId = new Map(writes.map((w) => [w.node.id, w]));
    for (const node of orderForInsert(writes.map((w) => w.node))) {
      const w = byId.get(node.id)!;
      this.s.nodes.set(node.id, copy(node));
      if (w.body) this.s.bodies.set(node.id, { ...w.body, nodeId: node.id });
    }
    for (const w of writes) {
      const id = w.node.id;
      if (w.links) {
        for (const [k, l] of this.s.links) if (l.sourceId === id) this.s.links.delete(k);
        for (const l of w.links)
          if (l.sourceId === id && this.s.nodes.has(l.targetId))
            this.s.links.set(linkKey(l), copy(l));
      }
      this.s.syncFts(id);
    }
    this.commit('nodes', 'nodeBodies', 'nodeLinks');
  }

  async deleteNodes(ids: readonly string[]): Promise<void> {
    if (this.s.cascadeDelete(ids).size > 0)
      this.commit('nodes', 'nodeBodies', 'nodeLinks', 'growthLogs');
  }

  async listLinks(q: { sourceId?: string; targetId?: string }): Promise<NodeLinkRecord[]> {
    return [...this.s.links.values()].filter((l) => matches(l, q)).map(copy);
  }

  async putGrowthLogs(rows: readonly GrowthLogRow[]): Promise<void> {
    for (const r of rows) {
      if (!this.s.nodes.has(r.nodeId)) throw new ForeignKeyError(`growth node ${r.nodeId}`);
      if (r.bookId && !this.s.nodes.has(r.bookId))
        throw new ForeignKeyError(`growth book ${r.bookId}`);
    }
    for (const r of rows) this.s.growth.set(r.id, copy(r));
    this.commit('growthLogs');
  }

  async listGrowthLogs(q: { nodeId?: string; bookId?: string }): Promise<GrowthLogRow[]> {
    return [...this.s.growth.values()]
      .filter((g) => matches(g, q))
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id))
      .map(copy);
  }

  async deleteGrowthLogs(ids: readonly string[]): Promise<void> {
    for (const id of ids) this.s.growth.delete(id);
    this.commit('growthLogs');
  }

  async getMediaAsset(id: string) {
    const m = this.s.media.get(id);
    return m ? copy(m) : null;
  }

  async listMediaAssets() {
    return [...this.s.media.values()].map(copy);
  }

  async putMediaAssets(rows: readonly MediaAssetRecord[]): Promise<void> {
    for (const r of rows) this.s.media.set(r.id, copy(r));
    this.commit('mediaAssets');
  }

  async deleteMediaAssets(ids: readonly string[]): Promise<void> {
    const gone = new Set(ids);
    for (const id of gone) this.s.media.delete(id);
    for (const n of this.s.nodes.values())
      if (n.coverAssetId && gone.has(n.coverAssetId)) n.coverAssetId = null;
    this.commit('mediaAssets', 'nodes');
  }

  async getSetting(key: string) {
    return this.s.settings.get(key)?.valueJson ?? null;
  }

  async setSetting(key: string, valueJson: string): Promise<void> {
    this.s.settings.set(key, { key, valueJson, updatedAt: new Date().toISOString() });
    this.commit('settings');
  }

  async deleteSetting(key: string): Promise<void> {
    if (this.s.settings.delete(key)) this.commit('settings');
  }

  async listSettingKeys(prefix: string): Promise<string[]> {
    return [...this.s.settings.keys()].filter((k) => k.startsWith(prefix)).sort();
  }

  async search(query: string, opts: { limit?: number } = {}) {
    return this.s.fts.search(query, opts.limit ?? 50);
  }

  async rebuildSearchIndex(): Promise<void> {
    this.s.fts.clear();
    for (const id of this.s.nodes.keys()) this.s.syncFts(id);
  }

  async integrity() {
    return this.s.integrity();
  }

  async putGimmicks(
    packs: readonly GimmickPackRow[],
    blueprints: readonly GimmickBlueprintRow[],
  ): Promise<void> {
    this.s.gimmicks = mergeCatalog(this.s.gimmicks, packs, blueprints);
    this.commit('gimmickPacks', 'gimmickBlueprints');
  }

  async searchGimmicks(q: CatalogQuery): Promise<GimmickBlueprintRow[]> {
    this.catalog.sync(this.s.gimmicks.gimmickBlueprints);
    return this.catalog.search(q);
  }

  async gimmickGenreCounts() {
    this.catalog.sync(this.s.gimmicks.gimmickBlueprints);
    return this.catalog.genreCounts();
  }

  async exportTables(): Promise<DatabaseTables> {
    return this.s.export();
  }

  async replaceAll(tables: DatabaseTables): Promise<void> {
    const backup = this.s.export();
    this.s.clear();
    try {
      this.s.load(tables);
    } catch (err) {
      this.s.clear();
      this.s.load(backup);
      throw err;
    }
    this.commit(...ALL_TABLES);
  }
}

export const createMemoryDatabase = (seed?: DatabaseTables): MemoryDatabase =>
  new MemoryDatabase('memory', seed);
