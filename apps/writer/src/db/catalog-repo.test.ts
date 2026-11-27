// Gimmick Catalog (schema v3): the memory index and the real SQLite FTS5 table (node:sqlite) give
// the same answers, Favorites / Recent persist in settings, and 1,000 blueprints search < 10 ms.
import type { GimmickBlueprint } from '@kn/core/gimmicks';
import { STARTER_BLUEPRINT_LIST } from '@kn/engines/blueprints';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { blueprintRow, CatalogRepository, RECENT_MAX } from './catalog-repo.ts';
import { searchCatalogSql } from './catalog-sql.ts';
import { createMemoryDatabase } from './memory-driver.ts';
import type { CatalogQuery, GimmickBlueprintRow } from './port.ts';
import { REBUILD_CATALOG_FTS, SCHEMA_V2, SCHEMA_V3_CATALOG } from './schema.ts';
import { BLUEPRINTS, PACKS, upsertSql } from './sql-rows.ts';

const T0 = '2026-11-27T10:00:00.000Z';
const GENRES = [
  'litrpg',
  'cyberpunk',
  'thriller',
  'fantasy',
  'mystery',
  'sci-fi',
  'horror',
  'core',
];
const WORDS = ['rain', 'neon', 'blade', 'whisper', 'ledger', 'ember', 'signal', 'frost', 'tide'];

function synthetic(n: number): GimmickBlueprint[] {
  const seed = STARTER_BLUEPRINT_LIST[0]!;
  return Array.from({ length: n }, (_, i) => ({
    ...seed,
    id: `syn-${i}`,
    genre: GENRES[i % GENRES.length]!,
    subgenre: `sub-${i % 13}`,
    name: `${WORDS[i % WORDS.length]} Gimmick ${i}`,
    tagline: `A ${WORDS[(i * 7) % WORDS.length]} moment number ${i}.`,
    tags: [WORDS[(i * 3) % WORDS.length]!, `tag${i % 50}`],
    mood: [i % 2 ? 'tense' : 'calm'],
    tier: i % 5 === 0 ? 'pro' : 'free',
  }));
}

function packsFor(list: readonly GimmickBlueprint[]) {
  return GENRES.map((g) => ({
    id: `pack-${g}`,
    genre: g,
    title: g,
    version: 1,
    blueprints: list.filter((b) => b.genre === g),
  }));
}

/** node:sqlite with the production v2 + v3 SQL, behind the async shape the driver uses. */
function sqliteCatalog(list: readonly GimmickBlueprint[]) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA_V2);
  db.exec(SCHEMA_V3_CATALOG);
  const packSql = db.prepare(upsertSql(PACKS));
  const bpSql = db.prepare(upsertSql(BLUEPRINTS));
  for (const p of packsFor(list)) {
    packSql.run(...PACKS.bind({ ...p, metaJson: null, createdAt: T0 }));
    for (const b of p.blueprints) bpSql.run(...BLUEPRINTS.bind(blueprintRow(b, p.id, T0)));
  }
  const port = {
    getAllAsync: async <R>(sql: string, args: (string | number)[]): Promise<R[]> =>
      db.prepare(sql).all(...args) as R[],
  } as Parameters<typeof searchCatalogSql>[0];
  return { db, search: (q: CatalogQuery) => searchCatalogSql(port, q) };
}

const ids = (rows: readonly GimmickBlueprintRow[]): string[] => rows.map((r) => r.id);

async function memoryRepo(list: readonly GimmickBlueprint[]) {
  const db = createMemoryDatabase();
  const repo = new CatalogRepository(db);
  await repo.install(packsFor(list), T0);
  return { db, repo };
}

describe('CatalogRepository', () => {
  it('installs every starter blueprint and finds them by name, tag and genre', async () => {
    const { repo } = await memoryRepo(
      STARTER_BLUEPRINT_LIST.filter((b) => GENRES.includes(b.genre)),
    );
    const all = await repo.search();
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((e) => e.blueprint?.id === e.row.id)).toBe(true);
    const first = all[0]!.blueprint!;
    const hit = await repo.search({ text: first.name.split(' ')[0]!.slice(0, 3) });
    expect(ids(hit.map((h) => h.row))).toContain(first.id);
  });

  it('memory and SQLite FTS5 agree on filters and ordering', async () => {
    const list = synthetic(300);
    const { db } = await memoryRepo(list);
    const sql = sqliteCatalog(list);
    const queries: CatalogQuery[] = [
      {},
      { genre: 'fantasy' },
      { text: 'emb' },
      { text: 'rain', genre: 'cyberpunk' },
      { text: '"neon gimmick"' },
      { tier: 'pro', engine: STARTER_BLUEPRINT_LIST[0]!.engine, limit: 7 },
      { ids: ['syn-4', 'syn-9', 'missing'] },
      { text: 'tag4' },
    ];
    for (const q of queries) {
      const mem = await db.searchGimmicks(q);
      const native = await sql.search(q);
      if (q.text) expect(new Set(ids(native))).toEqual(new Set(ids(mem)));
      else expect(ids(native)).toEqual(ids(mem));
    }
    // FTS sync triggers follow updates and deletes.
    sql.db
      .prepare(
        "UPDATE gimmick_blueprints SET config_json = json_set(config_json, '$.name', 'Zebra') WHERE id = 'syn-1'",
      )
      .run();
    expect(ids(await sql.search({ text: 'zebra' }))).toEqual(['syn-1']);
    sql.db.prepare("DELETE FROM gimmick_blueprints WHERE id = 'syn-1'").run();
    expect(await sql.search({ text: 'zebra' })).toEqual([]);
    sql.db.exec(REBUILD_CATALOG_FTS);
    expect(ids(await sql.search({ text: 'gimmick', limit: 1000 }))).toHaveLength(299);
  });

  it('1,000 blueprints: FTS search + genre filter answer in < 10 ms (memory and SQLite)', async () => {
    const list = synthetic(1000);
    const { db } = await memoryRepo(list);
    const sql = sqliteCatalog(list);
    await db.searchGimmicks({ text: 'warm-up' }); // builds the index once
    await sql.search({ text: 'warm' });
    const bench = async (run: () => Promise<unknown>): Promise<number> => {
      const runs: number[] = [];
      for (let i = 0; i < 5; i++) {
        const t = performance.now();
        await run();
        runs.push(performance.now() - t);
      }
      return runs.sort((a, b) => a - b)[2]!;
    };
    const memMs = await bench(() => db.searchGimmicks({ text: 'emb sig', genre: 'fantasy' }));
    const sqlMs = await bench(() => sql.search({ text: 'emb sig', genre: 'fantasy' }));
    const facetMs = await bench(() => db.gimmickGenreCounts());
    console.info(
      `[catalog bench] 1000 blueprints: memory ${memMs.toFixed(2)} ms, sqlite ${sqlMs.toFixed(2)} ms, facets ${facetMs.toFixed(2)} ms`,
    );
    expect(memMs).toBeLessThan(10);
    expect(sqlMs).toBeLessThan(10);
    expect(facetMs).toBeLessThan(10);
    expect((await db.gimmickGenreCounts()).reduce((n, f) => n + f.count, 0)).toBe(1000);
  });

  it('keeps Favorites and Recent in settings across a pack reinstall', async () => {
    const list = synthetic(20);
    const { repo } = await memoryRepo(list);
    expect(await repo.toggleFavorite('syn-3')).toBe(true);
    expect(await repo.toggleFavorite('syn-5')).toBe(true);
    expect(await repo.toggleFavorite('syn-3')).toBe(false);
    for (let i = 0; i < RECENT_MAX + 3; i++) await repo.pushRecent(`syn-${i % 15}`);
    await repo.pushRecent('syn-2');
    await repo.install(packsFor(list), T0);
    expect(await repo.favorites()).toEqual(['syn-5']);
    const recent = await repo.recent();
    expect(recent[0]).toBe('syn-2');
    expect(recent).toHaveLength(RECENT_MAX);
    expect(new Set(recent).size).toBe(RECENT_MAX);
    expect((await repo.getMany(['syn-5', 'nope', 'syn-2'])).map((b) => b.id)).toEqual([
      'syn-5',
      'syn-2',
    ]);
  });

  it('refuses blueprints whose pack is missing (SQLite foreign key parity)', async () => {
    const db = createMemoryDatabase();
    const row = blueprintRow(synthetic(1)[0]!, 'no-pack', T0);
    await expect(db.putGimmicks([], [row])).rejects.toThrow(/FOREIGN KEY/);
  });

  it('round-trips catalog rows through export / replaceAll', async () => {
    const { db } = await memoryRepo(synthetic(12));
    const copy = createMemoryDatabase(await db.exportTables());
    expect(ids(await copy.searchGimmicks({ text: 'gimmick' }))).toEqual(
      ids(await db.searchGimmicks({ text: 'gimmick' })),
    );
  });
});
