// The production v2 SQL (schema.ts + sql-rows.ts) executed on a REAL SQLite 3 with FTS5
// (Node's built-in `node:sqlite`): foreign keys, ON DELETE CASCADE, the FTS sync triggers (also
// on cascade deletes), the FTS5 MATCH grammar the native driver sends, and the 100k-word bench.
import type { NodeKind, NodeRecord } from '@kn/core';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { parseQuery, toFtsMatch } from './fts-query.ts';
import { REBUILD_FTS, SCHEMA_V2, SEARCH_SQL, WIPE_ALL } from './schema.ts';
import { BODIES, GROWTH, LINKS, NODES, upsertSql } from './sql-rows.ts';

const T0 = '2026-11-26T10:00:00.000Z';

function open(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA_V2);
  db.exec('PRAGMA user_version = 2');
  return db;
}

function node(
  id: string,
  kind: NodeKind,
  parentId: string | null,
  extra: Partial<NodeRecord> = {},
) {
  const r: NodeRecord = {
    id,
    kind,
    parentId,
    bookId: kind === 'book' || kind === 'note' ? null : 'b1',
    title: id,
    subtitle: null,
    position: 0,
    workspaceMode: null,
    coverAssetId: null,
    locked: false,
    deletedAt: null,
    wordCount: 0,
    createdAt: T0,
    updatedAt: T0,
    metaJson: null,
    ...extra,
  };
  return NODES.bind(r);
}

const body = (nodeId: string, text: string) =>
  BODIES.bind({ nodeId, blocksJson: '[]', plainText: text, updatedAt: T0 });

function seed(db: DatabaseSync): void {
  const n = db.prepare(upsertSql(NODES));
  const b = db.prepare(upsertSql(BODIES));
  n.run(...node('b1', 'book', null, { title: 'Chrome Tide' }));
  n.run(...node('s1', 'season', 'b1'));
  n.run(...node('c1', 'chapter', 's1'));
  n.run(...node('n1', 'note', null, { title: 'Mira Okafor' }));
  b.run(...body('c1', 'The second tide rose over the Lantern Room'));
  b.run(...body('n1', 'Harbour pilot'));
  db.prepare(upsertSql(LINKS)).run(
    ...LINKS.bind({ sourceId: 'c1', targetId: 'n1', relation: 'mention', createdAt: T0 }),
  );
  db.prepare(upsertSql(GROWTH)).run(
    ...GROWTH.bind({
      id: 'g1',
      nodeId: 'c1',
      bookId: 'b1',
      dateKey: '2026-11-26',
      wordCount: 3,
      chars: 9,
      sentences: 1,
      paragraphs: 1,
      isBaseline: true,
      recordedAt: T0,
    }),
  );
}

const search = (db: DatabaseSync, q: string): string[] =>
  (db.prepare(SEARCH_SQL).all(toFtsMatch(parseQuery(q)), 50) as { node_id: string }[]).map(
    (r) => r.node_id,
  );
const count = (db: DatabaseSync, table: string): number =>
  (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;

describe('v2 SQL schema on real SQLite + FTS5', () => {
  it('syncs nodes_fts on node + body writes and supports prefix, AND, accents and phrases', () => {
    const db = open();
    seed(db);
    expect(count(db, 'nodes_fts')).toBe(4);
    expect(search(db, 'tid').sort()).toEqual(['b1', 'c1']);
    expect(search(db, 'tid lant')).toEqual(['c1']);
    expect(search(db, 'MÍRA')).toEqual(['n1']);
    expect(search(db, '"second tide"')).toEqual(['c1']);
    expect(search(db, '"tide second"')).toEqual([]);
  });

  it('trash (deleted_at) leaves the index; restore and body updates re-index', () => {
    const db = open();
    seed(db);
    db.prepare('UPDATE nodes SET deleted_at = ? WHERE id = ?').run(T0, 'c1');
    expect(search(db, 'lant')).toEqual([]);
    db.prepare('UPDATE nodes SET deleted_at = NULL WHERE id = ?').run('c1');
    db.prepare(upsertSql(BODIES)).run(...body('c1', 'Neon harbour'));
    expect(search(db, 'neon')).toEqual(['c1']);
    expect(search(db, 'lant')).toEqual([]);
  });

  it('ON DELETE CASCADE wipes descendants, bodies, links, growth and their FTS rows', () => {
    const db = open();
    seed(db);
    db.prepare('DELETE FROM nodes WHERE id = ?').run('b1');
    expect(count(db, 'nodes')).toBe(1);
    for (const t of ['node_bodies', 'node_links', 'growth_logs'])
      expect(count(db, t)).toBe(t === 'node_bodies' ? 1 : 0);
    expect(count(db, 'nodes_fts')).toBe(1);
    expect(() => db.prepare(upsertSql(NODES)).run(...node('x', 'chapter', 'ghost'))).toThrow(
      /FOREIGN KEY/,
    );
  });

  it('wipe + replay + REBUILD_FTS restores a consistent index', () => {
    const db = open();
    seed(db);
    db.exec(`PRAGMA defer_foreign_keys = ON; ${WIPE_ALL}`);
    expect(count(db, 'nodes') + count(db, 'nodes_fts')).toBe(0);
    seed(db);
    db.exec(REBUILD_FTS);
    expect(count(db, 'nodes_fts')).toBe(count(db, 'nodes'));
  });

  it('100 chapters / 100,000 words: FTS5 prefix + phrase queries < 15 ms', () => {
    const db = open();
    const n = db.prepare(upsertSql(NODES));
    const b = db.prepare(upsertSql(BODIES));
    n.run(...node('b1', 'book', null));
    n.run(...node('s1', 'season', 'b1'));
    const words =
      'harbor chrome tide signal ghost lantern rain neon static drift ember quiet circuit salt'.split(
        ' ',
      );
    let seedN = 7;
    const rnd = (): number => (seedN = (seedN * 48271) % 2147483647) / 2147483647;
    db.exec('BEGIN');
    for (let i = 0; i < 100; i++) {
      const text = Array.from({ length: 1000 }, () => words[Math.floor(rnd() * words.length)]);
      if (i === 42) text.splice(500, 2, 'zephyrine', 'cascade');
      n.run(...node(`c${i}`, 'chapter', 's1', { position: i }));
      b.run(...body(`c${i}`, text.join(' ')));
    }
    db.exec('COMMIT');
    const timings: number[] = [];
    for (const q of ['zeph', '"zephyrine cascade"', 'chro tid', 'lant ember salt']) {
      const t = performance.now();
      expect(search(db, q).length).toBeGreaterThan(0);
      timings.push(performance.now() - t);
    }
    expect(search(db, '"zephyrine cascade"')).toEqual(['c42']);
    console.info(
      `[bench] SQLite FTS5 100k-word ms: ${timings.map((t) => t.toFixed(2)).join(' / ')}`,
    );
    expect(Math.max(...timings)).toBeLessThan(15);
  });
});
