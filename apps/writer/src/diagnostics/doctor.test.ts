import { ulid } from '@kn/core';
import { describe, expect, it } from 'vitest';
import { createMemoryDatabase } from '../db/memory-driver.ts';
import type { DatabasePort } from '../db/port.ts';
import { loadDemoNovel } from '../store/demo.ts';
import { setItemCover } from '../store/covers.ts';
import { NovelRepository } from '../store/repository.ts';
import { repairAll, repairIssue, scanWorkspace, summaryLine, type Issue } from './doctor.ts';

const NOW = Date.parse('2026-11-26T12:00:00Z');
const prose = (text = 'Hello lighthouse') => ({ id: ulid(), kind: 'prose' as const, text });

async function workspace(root = '') {
  const db = createMemoryDatabase();
  const repo = new NovelRepository(db, () => NOW, root);
  const novel = await repo.createNovel({ title: 'Tide', author: 'Me', sectionLabel: 'Season' });
  const season = (await repo.listSeasons(novel.id))[0]!;
  const chapter = (await repo.listChapters(novel.id, season.id))[0]!;
  await repo.saveChapter(novel.id, { ...chapter, blocks: [prose()] });
  return { db, repo, novel, season, chapter };
}

const find = (issues: Issue[], code: string, key?: string): Issue | undefined =>
  issues.find((i) => i.id.startsWith(`${code}:`) && (key === undefined || i.key === key));

describe('scanWorkspace', () => {
  it('reports nothing for a fresh workspace and the demo novel', async () => {
    const { repo } = await workspace();
    expect(await scanWorkspace(repo)).toEqual([]);
    await loadDemoNovel(repo);
    expect(await scanWorkspace(repo)).toEqual([]);
    expect(summaryLine([], 12)).toBe('No issues · scanned 12 entries');
  });

  it('stays clear after Trash and after emptying the Trash', async () => {
    const { db, repo, chapter } = await workspace();
    const node = (await db.getNode(chapter.id))!;
    await db.putNodes([{ node: { ...node, deletedAt: '2026-11-25T00:00:00.000Z' } }]);
    expect(await scanWorkspace(repo)).toEqual([]);
    await db.deleteNodes([chapter.id]);
    await db.deleteSetting(`meta/item/${chapter.id}`);
    expect(await scanWorkspace(repo)).toEqual([]);
  });

  it('detects a search index mismatch and repairs it', async () => {
    const { db, repo } = await workspace();
    let stale = true;
    const faulty: DatabasePort = Object.create(db) as DatabasePort;
    faulty.integrity = async () => {
      const ig = await db.integrity();
      return stale ? { ...ig, ftsRows: ig.ftsRows + 2 } : ig;
    };
    faulty.rebuildSearchIndex = async () => {
      stale = false;
      await db.rebuildSearchIndex();
    };
    const broken = new NovelRepository(faulty, () => NOW);
    const issues = await scanWorkspace(broken);
    expect(find(issues, 'fts', 'fts')?.repair).toBe('rebuild-index');
    expect(await repairAll(broken)).toBe(1);
    expect(await scanWorkspace(broken)).toEqual([]);
    expect(repo.db.driver).toBe('memory');
  });

  it('detects a cover whose file is missing and clears it', async () => {
    const { db, repo, novel } = await workspace('file:///docs/');
    const f = (uri: string) => ({ uri, width: 1, height: 1, bytes: 1, mimeType: 'image/jpeg' });
    await setItemCover(repo, novel.id, {
      cover: f('file:///docs/covers/a.jpg'),
      thumb: f('file:///docs/covers/a.thumb.jpg'),
    });
    expect(await scanWorkspace(repo, { fileExists: async () => true })).toEqual([]);
    const issues = await scanWorkspace(repo, { fileExists: async () => false });
    const media = issues.filter((i) => i.key.startsWith('media/'));
    expect(media).toHaveLength(2);
    expect(media[0]!.repair).toBe('clear-uri');
    expect(await repairAll(repo, { fileExists: async () => false })).toBe(2);
    expect((await db.getNode(novel.id))!.coverAssetId).toBeNull();
    expect(await scanWorkspace(repo, { fileExists: async () => false })).toEqual([]);
  });

  it('detects orphan sidecars and removes them to quarantine', async () => {
    const { db, repo, chapter } = await workspace();
    await db.setSetting(`meta/item/${chapter.id}`, '{"data":{},"updatedAt":1}');
    await db.setSetting('meta/item/ghost', '{"data":{"tags":[]},"updatedAt":1}');
    await db.setSetting('versions/chapter:ghost', '{"data":[],"updatedAt":1}');
    const issues = await scanWorkspace(repo);
    expect(issues.map((i) => i.key).sort()).toEqual([
      'setting/meta/item/ghost',
      'setting/versions/chapter:ghost',
    ]);
    expect(issues.every((i) => i.repair === 'remove-sidecar' && i.severity === 'info')).toBe(true);
    expect(await repairIssue(repo, issues[0]!, { now: () => 7 })).toBe(true);
    expect(await db.getSetting('meta/item/ghost')).toBeNull();
    expect(await db.getSetting('quarantine/meta/item/ghost')).toContain('"quarantinedAt":7');
    await repairAll(repo);
    expect(await scanWorkspace(repo)).toEqual([]);
    expect(await db.getSetting(`meta/item/${chapter.id}`)).not.toBeNull();
  });

  it('detects invalid bodies, unknown modules and bad module props', async () => {
    const { db, repo, chapter } = await workspace();
    const body = (await db.getBody(chapter.id))!;
    const node = (await db.getNode(chapter.id))!;
    const mod = (moduleId: string, props: unknown) => ({
      id: ulid(),
      kind: 'module',
      moduleId,
      moduleVersion: 1,
      props,
    });
    const put = (blocks: string) => db.putNodes([{ node, body: { ...body, blocksJson: blocks } }]);
    await put('{not json');
    expect(find(await scanWorkspace(repo), 'invalid-body', `node/${chapter.id}`)?.severity).toBe(
      'error',
    );
    await put(JSON.stringify([{ id: 'nope', kind: 'prose', text: 'x' }]));
    expect(find(await scanWorkspace(repo), 'invalid-body')).toBeDefined();
    await put(JSON.stringify([mod('no-such-module', {})]));
    expect(find(await scanWorkspace(repo), 'unknown-module')?.ref).toBeDefined();
    const getModule = () => ({ validate: () => ({ ok: false, errors: ['bad'] }) });
    await put(JSON.stringify([mod('x-y', {})]));
    expect(find(await scanWorkspace(repo, { getModule }), 'bad-props')?.detail).toContain('bad');
  });

  it('detects a misplaced chapter', async () => {
    const { db, repo, novel, chapter } = await workspace();
    const node = (await db.getNode(chapter.id))!;
    await db.putNodes([{ node: { ...node, parentId: novel.id } }]);
    expect(find(await scanWorkspace(repo), 'broken-tree', `node/${chapter.id}`)).toBeDefined();
  });
});
