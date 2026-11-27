// Native catalog queries over the v3 `gimmick_blueprints_fts` FTS5 table. Same filters and order
// as `catalog-index.ts` (the memory / web engine), so both drivers return identical rows.
import type * as SQLite from 'expo-sqlite';
import { isEmptyQuery, parseQuery, toFtsMatch } from './fts-query.ts';
import type { CatalogFacet, CatalogQuery, GimmickBlueprintRow } from './port.ts';
import { BLUEPRINTS, type Row } from './sql-rows.ts';

type Db = Pick<SQLite.SQLiteDatabase, 'getAllAsync'>;

const COLS = BLUEPRINTS.cols.map((c) => `b.${c}`).join(', ');
const NAME = "COALESCE(json_extract(b.config_json, '$.name'), b.title)";

export async function searchCatalogSql(
  db: Db,
  q: CatalogQuery,
): Promise<GimmickBlueprintRow[]> {
  const where: string[] = [];
  const args: (string | number)[] = [];
  const parsed = parseQuery(q.text ?? '');
  const text = !isEmptyQuery(parsed);
  if (text) {
    where.push('gimmick_blueprints_fts MATCH ?');
    args.push(toFtsMatch(parsed));
  }
  if (q.genre) {
    where.push('b.genre = ?');
    args.push(q.genre);
  }
  if (q.engine) {
    where.push('b.engine = ?');
    args.push(q.engine);
  }
  if (q.tier) {
    where.push("COALESCE(json_extract(b.config_json, '$.tier'), 'free') = ?");
    args.push(q.tier);
  }
  if (q.ids) {
    if (q.ids.length === 0) return [];
    where.push(`b.id IN (${q.ids.map(() => '?').join(', ')})`);
    args.push(...q.ids);
  }
  const from = text
    ? 'gimmick_blueprints_fts f JOIN gimmick_blueprints b ON b.rowid = f.rowid'
    : 'gimmick_blueprints b';
  const order = text
    ? 'bm25(gimmick_blueprints_fts, 0.0, 10.0, 2.0, 1.0, 1.0, 1.0, 1.0), b.id'
    : `${NAME} COLLATE NOCASE, b.id`;
  const sql = `SELECT ${COLS} FROM ${from}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY ${order} LIMIT ?`;
  const rows = await db.getAllAsync<Row>(sql, [...args, q.limit ?? 200]);
  return rows.map((r) => BLUEPRINTS.read(r));
}

export async function catalogGenreCountsSql(db: Db): Promise<CatalogFacet[]> {
  const rows = await db.getAllAsync<{ genre: string; c: number }>(
    'SELECT genre, COUNT(*) AS c FROM gimmick_blueprints GROUP BY genre ORDER BY c DESC, genre',
  );
  return rows.map((r) => ({ genre: r.genre, count: r.c }));
}
