import type { NodeKind, NodeRecord } from '@kn/core';
import { describe, expect, it } from 'vitest';
import { createMemoryDatabase, ForeignKeyError, MemoryDatabase } from './memory-driver.ts';
import { parseQuery, toFtsMatch } from './fts-query.ts';
import type { DatabasePort, GrowthLogRow } from './port.ts';

const T0 = '2026-11-26T10:00:00.000Z';

function node(
  id: string,
  kind: NodeKind,
  parentId: string | null,
  extra: Partial<NodeRecord> = {},
) {
  const bookId =
    kind === 'book' || kind === 'folder' || kind === 'note' ? null : (extra.bookId ?? 'b1');
  return {
    id,
    kind,
    parentId,
    bookId,
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
  } satisfies NodeRecord;
}

const body = (nodeId: string, plainText: string) => ({
  nodeId,
  blocksJson: '[]',
  plainText,
  updatedAt: T0,
});

const growth = (id: string, nodeId: string, bookId: string | null): GrowthLogRow => ({
  id,
  nodeId,
  bookId,
  dateKey: '2026-11-26',
  wordCount: 3,
  chars: 9,
  sentences: 1,
  paragraphs: 1,
  isBaseline: false,
  recordedAt: T0,
});

async function seedBook(db: DatabasePort): Promise<void> {
  await db.putNodes([
    { node: node('b1', 'book', null) },
    { node: node('s1', 'season', 'b1') },
    {
      node: node('c2', 'chapter', 's1', { position: 2 }),
      body: body('c2', 'The second tide rose'),
    },
    { node: node('c1', 'chapter', 's1', { position: 1 }), body: body('c1', 'Chrome tide at dawn') },
    { node: node('n1', 'note', null, { title: 'Mira Okafor' }), body: body('n1', 'Harbor pilot') },
  ]);
}

// The shared contract every driver must satisfy. Native SQLite runs the same suite through the
// on-device Doctor; Vitest runs it against the in-memory engine and the web driver's engine.
const drivers: Array<[string, () => DatabasePort]> = [
  ['memory', () => createMemoryDatabase()],
  ['web engine', () => new MemoryDatabase('web')],
];

describe.each(drivers)('DatabasePort contract (%s)', (_name, make) => {
  it('round-trips nodes and bodies, ordered by position', async () => {
    const db = make();
    await seedBook(db);
    expect((await db.listNodes({ parentId: 's1' })).map((n) => n.id)).toEqual(['c1', 'c2']);
    expect((await db.getBody('c1'))?.plainText).toBe('Chrome tide at dawn');
    expect((await db.listNodes({ parentId: null })).map((n) => n.id)).toEqual(['b1', 'n1']);
    expect((await db.listNodes({ bookId: 'b1', kinds: ['chapter'] })).length).toBe(2);
  });

  it('enforces foreign keys on parents and covers', async () => {
    const db = make();
    await expect(db.putNodes([{ node: node('x', 'chapter', 'missing') }])).rejects.toThrow(
      ForeignKeyError,
    );
    await expect(
      db.putNodes([{ node: node('y', 'note', null, { coverAssetId: 'nope' }) }]),
    ).rejects.toThrow(ForeignKeyError);
  });

  it('ON DELETE CASCADE wipes descendants, bodies, links and growth logs', async () => {
    const db = make();
    await seedBook(db);
    const link = { sourceId: 'c1', targetId: 'n1', relation: 'mention' as const, createdAt: T0 };
    await db.putNodes([{ node: node('c1', 'chapter', 's1', { position: 1 }), links: [link] }]);
    await db.putGrowthLogs([growth('g1', 'c1', 'b1'), growth('g2', 'b1', 'b1')]);
    expect(await db.listLinks({ targetId: 'n1' })).toHaveLength(1);
    await db.deleteNodes(['b1']);
    expect(await db.listNodes({ includeDeleted: true })).toHaveLength(1);
    expect(await db.getBody('c1')).toBeNull();
    expect(await db.listLinks({ targetId: 'n1' })).toEqual([]);
    expect(await db.listGrowthLogs({})).toEqual([]);
    expect(await db.integrity()).toMatchObject({
      ftsRows: 1,
      activeNodes: 1,
      brokenParents: 0,
      orphanBodies: 0,
      orphanLinks: 0,
      orphanGrowth: 0,
    });
  });

  it('keeps trashed nodes out of search and active lists, back in on restore', async () => {
    const db = make();
    await seedBook(db);
    const c1 = (await db.getNode('c1'))!;
    await db.putNodes([{ node: { ...c1, deletedAt: T0 } }]);
    expect((await db.listNodes({ parentId: 's1' })).map((n) => n.id)).toEqual(['c2']);
    expect(await db.search('chrome')).toEqual([]);
    expect((await db.integrity()).ftsRows).toBe(4);
    await db.putNodes([{ node: { ...c1, deletedAt: null } }]);
    expect((await db.search('chrome')).map((h) => h.nodeId)).toEqual(['c1']);
  });

  it('FTS prefix, AND, accent-folded and phrase search', async () => {
    const db = make();
    await seedBook(db);
    expect((await db.search('tid')).map((h) => h.nodeId).sort()).toEqual(['c1', 'c2']);
    expect((await db.search('tid daw')).map((h) => h.nodeId)).toEqual(['c1']);
    expect((await db.search('MÍRA')).map((h) => h.nodeId)).toEqual(['n1']);
    expect((await db.search('"second tide"')).map((h) => h.nodeId)).toEqual(['c2']);
    expect(await db.search('"tide second"')).toEqual([]);
    expect(await db.search('   ')).toEqual([]);
  });

  it('settings, media (SET NULL) and full export / replace', async () => {
    const db = make();
    await seedBook(db);
    await db.setSetting('setting/x', '1');
    const asset = {
      id: 'm1',
      kind: 'cover' as const,
      relativePath: 'covers/m1.jpg',
      mimeType: 'image/jpeg',
      width: 1200,
      height: 1800,
      bytes: 10,
      createdAt: T0,
    };
    await db.putMediaAssets([asset]);
    await db.putNodes([{ node: node('b1', 'book', null, { coverAssetId: 'm1' }) }]);
    const dump = await db.exportTables();
    await db.deleteMediaAssets(['m1']);
    expect((await db.getNode('b1'))?.coverAssetId).toBeNull();
    const other = make();
    await other.replaceAll(dump);
    expect((await other.getNode('b1'))?.coverAssetId).toBe('m1');
    expect(await other.listSettingKeys('setting/')).toEqual(['setting/x']);
    expect((await other.search('dawn')).map((h) => h.nodeId)).toEqual(['c1']);
    await expect(
      other.replaceAll({ ...dump, nodes: [node('z', 'chapter', 'ghost')] }),
    ).rejects.toThrow();
    expect((await other.listNodes()).length).toBe(5); // failed restore leaves data untouched
  });
});

describe('FTS5 query builder', () => {
  it('turns words into prefix tokens and quoted text into phrases', () => {
    expect(toFtsMatch(parseQuery('Tíde "old  mill" x-ray'))).toBe('"tide"* "x"* "ray"* "old mill"');
  });
});

const WORDS =
  'harbor chrome tide signal ghost lantern rain neon static drift ember quiet circuit salt'.split(
    ' ',
  );

describe('search benchmark', () => {
  it('100 chapters / 100,000 words answer prefix and phrase queries in < 15 ms', async () => {
    const db = createMemoryDatabase();
    await db.putNodes([{ node: node('b1', 'book', null) }, { node: node('s1', 'season', 'b1') }]);
    let seed = 7;
    const rnd = (): number => (seed = (seed * 48271) % 2147483647) / 2147483647;
    const writes = Array.from({ length: 100 }, (_, i) => {
      const words = Array.from({ length: 1000 }, () => WORDS[Math.floor(rnd() * WORDS.length)]);
      if (i === 42) words.splice(500, 2, 'zephyrine', 'cascade');
      const id = `c${i}`;
      return { node: node(id, 'chapter', 's1', { position: i }), body: body(id, words.join(' ')) };
    });
    await db.putNodes(writes);
    const timings: number[] = [];
    for (const q of ['zeph', '"zephyrine cascade"', 'chro tid', 'lant ember salt']) {
      const t = performance.now();
      const hits = await db.search(q);
      timings.push(performance.now() - t);
      expect(hits.length).toBeGreaterThan(0);
    }
    expect((await db.search('"zephyrine cascade"')).map((h) => h.nodeId)).toEqual(['c42']);
    console.info(`[bench] 100k-word FTS ms: ${timings.map((t) => t.toFixed(2)).join(' / ')}`);
    expect(Math.max(...timings)).toBeLessThan(15);
  });
});
