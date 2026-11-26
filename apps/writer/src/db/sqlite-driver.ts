// Native (Android / iOS) DatabasePort over expo-sqlite: WAL, foreign keys, FTS5 via triggers.
// SQLite is the source of truth; every table is also hydrated into the in-memory relational
// engine on open and every committed write is applied to it, so screens read from memory
// (no blank frames while switching Library ↔ Outline ↔ Editor). Search runs on FTS5.
import type { NodeRecord } from '@kn/core';
import * as SQLite from 'expo-sqlite';
import { isEmptyQuery, parseQuery, toFtsMatch } from './fts-query.ts';
import { MemoryDatabase } from './memory-driver.ts';
import {
  DATABASE_NAME,
  emptyTables,
  SCHEMA_USER_VERSION,
  type DatabasePort,
  type DatabaseTables,
  type GrowthLogRow,
  type IntegrityCounts,
  type NodeWrite,
} from './port.ts';
import { OPEN_PRAGMAS, REBUILD_FTS, SCHEMA_V2, SEARCH_SQL, WIPE_ALL } from './schema.ts';
import { orderForInsert } from './rows.ts';
import * as T from './sql-rows.ts';

type Db = SQLite.SQLiteDatabase;
type Tx = Pick<Db, 'runAsync' | 'execAsync' | 'getAllAsync'>;

async function migrate(db: Db): Promise<void> {
  await db.execAsync(OPEN_PRAGMAS);
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((row?.user_version ?? 0) >= SCHEMA_USER_VERSION) return;
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.execAsync(SCHEMA_V2);
    await tx.execAsync(`PRAGMA user_version = ${SCHEMA_USER_VERSION}`);
  });
}

async function readAll(db: Tx): Promise<DatabaseTables> {
  const out = emptyTables();
  for (const [key, spec] of T.TABLE_ORDER) {
    const rows = await db.getAllAsync<T.Row>(`SELECT ${spec.cols.join(', ')} FROM ${spec.table}`);
    (out[key] as object[]) = rows.map((r) => spec.read(r));
  }
  return out;
}

async function upsert<R>(tx: Tx, spec: T.TableSpec<R>, rows: readonly R[]): Promise<void> {
  const sql = T.upsertSql(spec);
  for (const r of rows) await tx.runAsync(sql, spec.bind(r));
}

const marks = (n: number): string => Array.from({ length: n }, () => '?').join(', ');

class SqliteDatabase implements DatabasePort {
  readonly driver = 'sqlite' as const;
  readonly schemaVersion = SCHEMA_USER_VERSION;

  constructor(
    private readonly db: Db,
    private readonly mirror: MemoryDatabase,
  ) {}

  private tx(task: (tx: Tx) => Promise<void>): Promise<void> {
    return this.db.withExclusiveTransactionAsync(task);
  }

  getNode = (id: string) => this.mirror.getNode(id);
  listNodes: DatabasePort['listNodes'] = (q) => this.mirror.listNodes(q);
  getBody = (id: string) => this.mirror.getBody(id);
  listLinks: DatabasePort['listLinks'] = (q) => this.mirror.listLinks(q);
  listGrowthLogs: DatabasePort['listGrowthLogs'] = (q) => this.mirror.listGrowthLogs(q);
  getMediaAsset = (id: string) => this.mirror.getMediaAsset(id);
  listMediaAssets = () => this.mirror.listMediaAssets();
  getSetting = (key: string) => this.mirror.getSetting(key);
  listSettingKeys = (prefix: string) => this.mirror.listSettingKeys(prefix);
  exportTables = () => this.mirror.exportTables();

  async putNodes(writes: readonly NodeWrite[]): Promise<void> {
    this.mirror.checkNodeWrites(writes);
    const known = new Set<string>(writes.map((w) => w.node.id));
    await this.tx(async (tx) => {
      await upsert<NodeRecord>(tx, T.NODES, orderForInsert(writes.map((w) => w.node)));
      await upsert(
        tx,
        T.BODIES,
        writes.flatMap((w) => (w.body ? [{ ...w.body, nodeId: w.node.id }] : [])),
      );
      for (const w of writes) {
        if (!w.links) continue;
        await tx.runAsync('DELETE FROM node_links WHERE source_id = ?', w.node.id);
        const targets = w.links.filter(
          (l) =>
            l.sourceId === w.node.id && (known.has(l.targetId) || this.mirror.hasNode(l.targetId)),
        );
        await upsert(tx, T.LINKS, targets);
      }
    });
    await this.mirror.putNodes(writes);
  }

  async deleteNodes(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.tx(async (tx) => {
      await tx.runAsync(`DELETE FROM nodes WHERE id IN (${marks(ids.length)})`, [...ids]);
    });
    await this.mirror.deleteNodes(ids);
  }

  async putGrowthLogs(rows: readonly GrowthLogRow[]): Promise<void> {
    await this.tx((tx) => upsert(tx, T.GROWTH, rows));
    await this.mirror.putGrowthLogs(rows);
  }

  async deleteGrowthLogs(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.tx(async (tx) => {
      await tx.runAsync(`DELETE FROM growth_logs WHERE id IN (${marks(ids.length)})`, [...ids]);
    });
    await this.mirror.deleteGrowthLogs(ids);
  }

  async putMediaAssets(rows: Parameters<DatabasePort['putMediaAssets']>[0]): Promise<void> {
    await this.tx((tx) => upsert(tx, T.MEDIA, rows));
    await this.mirror.putMediaAssets(rows);
  }

  async deleteMediaAssets(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.tx(async (tx) => {
      await tx.runAsync(`DELETE FROM media_assets WHERE id IN (${marks(ids.length)})`, [...ids]);
    });
    await this.mirror.deleteMediaAssets(ids);
  }

  async setSetting(key: string, valueJson: string): Promise<void> {
    const row = { key, valueJson, updatedAt: new Date().toISOString() };
    await this.db.runAsync(T.upsertSql(T.SETTINGS), T.SETTINGS.bind(row));
    await this.mirror.setSetting(key, valueJson);
  }

  async deleteSetting(key: string): Promise<void> {
    await this.db.runAsync('DELETE FROM settings WHERE key = ?', key);
    await this.mirror.deleteSetting(key);
  }

  async search(query: string, opts: { limit?: number } = {}) {
    const q = parseQuery(query);
    if (isEmptyQuery(q)) return [];
    const rows = await this.db.getAllAsync<{ node_id: string; rank: number }>(
      SEARCH_SQL,
      toFtsMatch(q),
      opts.limit ?? 50,
    );
    return rows.map((r) => ({ nodeId: r.node_id, rank: r.rank }));
  }

  async rebuildSearchIndex(): Promise<void> {
    await this.tx((tx) => tx.execAsync(REBUILD_FTS));
    await this.mirror.rebuildSearchIndex();
  }

  async integrity(): Promise<IntegrityCounts> {
    const one = async (sql: string): Promise<number> =>
      (await this.db.getFirstAsync<{ c: number }>(sql))?.c ?? 0;
    return {
      ftsRows: await one('SELECT COUNT(*) AS c FROM nodes_fts'),
      activeNodes: await one('SELECT COUNT(*) AS c FROM nodes WHERE deleted_at IS NULL'),
      brokenParents: await one(
        'SELECT COUNT(*) AS c FROM nodes n WHERE n.parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM nodes p WHERE p.id = n.parent_id)',
      ),
      orphanBodies: await one(
        'SELECT COUNT(*) AS c FROM node_bodies b WHERE NOT EXISTS (SELECT 1 FROM nodes n WHERE n.id = b.node_id)',
      ),
      orphanLinks: await one(
        'SELECT COUNT(*) AS c FROM node_links l WHERE NOT EXISTS (SELECT 1 FROM nodes n WHERE n.id = l.source_id) OR NOT EXISTS (SELECT 1 FROM nodes n WHERE n.id = l.target_id)',
      ),
      orphanGrowth: await one(
        'SELECT COUNT(*) AS c FROM growth_logs g WHERE NOT EXISTS (SELECT 1 FROM nodes n WHERE n.id = g.node_id)',
      ),
    };
  }

  async replaceAll(tables: DatabaseTables): Promise<void> {
    const staged = new MemoryDatabase('memory', tables); // validates foreign keys first
    const clean = await staged.exportTables();
    await this.tx(async (tx) => {
      await tx.execAsync(`PRAGMA defer_foreign_keys = ON; ${WIPE_ALL}`);
      for (const [key, spec] of T.TABLE_ORDER)
        await upsert(tx, spec as T.TableSpec<object>, clean[key]);
      await tx.execAsync(REBUILD_FTS);
    });
    await this.mirror.replaceAll(clean);
  }
}

let opening: Promise<DatabasePort> | null = null;

/** Opens (once) `kinetic-writer-v2.db`, applies the v2 schema and hydrates the read mirror. */
export function openDatabase(): Promise<DatabasePort> {
  opening ??= SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
    await migrate(db);
    const mirror = new MemoryDatabase('memory', await readAll(db));
    return new SqliteDatabase(db, mirror);
  });
  return opening;
}
