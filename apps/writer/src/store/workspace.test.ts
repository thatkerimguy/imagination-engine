import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from '../storage/memory.ts';
import {
  breadcrumbs,
  createDoc,
  createFolder,
  deleteFolderRecursive,
  fallbackTitle,
  getDoc,
  listChildren,
  moveFolder,
  saveDoc,
} from './folders.ts';
import { promoteDocToChapter } from './note-promote.ts';
import { normalizeItemMeta, sortItems, updateItemMeta, type ItemMeta } from './item-meta.ts';
import { NovelRepository } from './repository.ts';
import {
  AUTO_CHECKPOINT_MS,
  AUTO_RING_SIZE,
  addSnapshot,
  loadVersions,
  makeSnapshot,
  prepareRestore,
  recordAutoCheckpoint,
  saveManualCheckpoint,
  type VersionLog,
} from './versions.ts';

const A = '01M7WD7TG0SRH8FFJAF28FHTHC';
const B = '01M7WD7TG1R63M5MJ69NG6995F';
const repo = (): NovelRepository => new NovelRepository(createMemoryAdapter());

describe('folders & notes', () => {
  it('nests folders endlessly and walks breadcrumbs', async () => {
    const r = repo();
    const world = await createFolder(r, 'Worldbuilding', null);
    const harbour = await createFolder(r, 'Harbour', world.id);
    const docks = await createFolder(r, 'Docks', harbour.id);
    expect((await breadcrumbs(r, docks.id)).map((f) => f.title)).toEqual([
      'Worldbuilding',
      'Harbour',
      'Docks',
    ]);
    await expect(moveFolder(r, world.id, docks.id)).rejects.toThrow();
    await moveFolder(r, docks.id, null);
    expect((await listChildren(r, null)).folders.map((f) => f.title).sort()).toEqual([
      'Docks',
      'Worldbuilding',
    ]);
  });

  it('auto-titles unnamed notes from the first six words until named', async () => {
    const r = repo();
    const d = await createDoc(r, null);
    expect(d.title).toBe('Untitled note');
    const words = 'The rain kept falling on Roanapur all night long';
    const saved = await saveDoc(r, d.id, { blocks: [{ id: A, kind: 'prose', text: words }] });
    expect(saved.title).toBe('The rain kept falling on Roanapur');
    const named = await saveDoc(r, d.id, { title: 'Rain' });
    expect(named.title).toBe('Rain');
    expect((await saveDoc(r, d.id, { blocks: [] })).title).toBe('Rain');
    expect(fallbackTitle([{ id: B, kind: 'prose', text: '**Bold** {{note}} start' }])).toBe(
      'Bold start',
    );
  });

  it('deletes a folder tree with its notes and sidecars', async () => {
    const r = repo();
    const top = await createFolder(r, 'Top', null);
    const sub = await createFolder(r, 'Sub', top.id);
    const note = await createDoc(r, sub.id, { title: 'Deep' });
    await updateItemMeta(r, note.id, { pinned: true });
    await deleteFolderRecursive(r, top.id);
    expect(await getDoc(r, note.id)).toBeNull();
    expect(await r.docs.keys('meta/item/')).toEqual([]);
    expect(await r.docs.keys('folder/')).toEqual([]);
  });

  it('promotes a note into a @kn/core-valid chapter', async () => {
    const r = repo();
    const novel = await r.createNovel({ title: 'N', author: 'A', sectionLabel: 'Season' });
    const seasonId = novel.seasons[0]!;
    const doc = await createDoc(r, null, {
      title: 'Harbour scene',
      blocks: [
        { id: A, kind: 'prose', text: 'Fog {fg:#FF0000}rolled{/fg} in.' },
        { id: B, kind: 'dialogue', speaker: '', text: 'unfinished' },
      ],
    });
    const chapter = await promoteDocToChapter(r, doc.id, novel.id, seasonId);
    expect(chapter.title).toBe('Harbour scene');
    expect(chapter.blocks).toEqual([{ id: A, kind: 'prose', text: 'Fog rolled in.' }]);
    expect((await r.getSeason(novel.id, seasonId))?.chapters.at(-1)).toBe(chapter.id);
  });
});

describe('item meta', () => {
  it('normalizes junk', () => {
    expect(normalizeItemMeta({ tags: ['#Lore', 'lore', 3], color: 'red', wordGoal: -1 })).toEqual({
      tags: ['lore'],
    });
  });

  it('floats pinned items first, then sorts by mode', () => {
    const items = [
      { id: 'a', kind: 'doc' as const, title: 'Beta', updatedAt: 3, createdAt: 1, words: 10 },
      { id: 'b', kind: 'folder' as const, title: 'alpha', updatedAt: 1, createdAt: 3, words: 50 },
      { id: 'c', kind: 'doc' as const, title: 'Gamma', updatedAt: 2, createdAt: 2, words: 30 },
    ];
    const meta = new Map<string, ItemMeta>([['c', { tags: [], pinned: true }]]);
    const ids = (m: Parameters<typeof sortItems>[1]): string[] =>
      sortItems(items, m, meta).map((i) => i.id);
    expect(ids('name-asc')).toEqual(['c', 'b', 'a']);
    expect(ids('date-edited')).toEqual(['c', 'a', 'b']);
    expect(ids('date-created')).toEqual(['c', 'b', 'a']);
    expect(ids('type')).toEqual(['c', 'b', 'a']);
    expect(ids('word-count')).toEqual(['c', 'b', 'a']);
  });
});

describe('version history', () => {
  const blocks = (text: string): unknown[] => [{ id: A, kind: 'prose', text }];

  it('takes at most one auto checkpoint per 5 minutes, only on change', async () => {
    const r = repo();
    const t = 1_000_000;
    expect(await recordAutoCheckpoint(r, 'chapter:c', blocks('one'), t)).toBe(true);
    expect(await recordAutoCheckpoint(r, 'chapter:c', blocks('two'), t + 1000)).toBe(false);
    const later = t + AUTO_CHECKPOINT_MS;
    expect(await recordAutoCheckpoint(r, 'chapter:c', blocks('one'), later)).toBe(false);
    expect(await recordAutoCheckpoint(r, 'chapter:c', blocks('two'), later)).toBe(true);
  });

  it('keeps a 30-item auto ring but every manual checkpoint', () => {
    let log: VersionLog = { snapshots: [] };
    log = addSnapshot(log, makeSnapshot('manual', blocks('m'), 0, 'Draft 1'));
    for (let i = 1; i <= 40; i++) log = addSnapshot(log, makeSnapshot('auto', blocks(`${i}`), i));
    expect(log.snapshots.filter((s) => s.kind === 'auto')).toHaveLength(AUTO_RING_SIZE);
    expect(log.snapshots.some((s) => s.label === 'Draft 1')).toBe(true);
    expect(log.snapshots[0]!.ts).toBe(40);
  });

  it('writes a "Before restore" snapshot before restoring', async () => {
    const r = repo();
    const snap = await saveManualCheckpoint(r, 'doc:d', blocks('old words'), 'v1', 10);
    const restored = await prepareRestore(r, 'doc:d', snap.id, blocks('new words here'), 20);
    expect(restored).toEqual(blocks('old words'));
    const log = await loadVersions(r, 'doc:d');
    expect(log.snapshots[0]).toMatchObject({ kind: 'pre-restore', label: 'Before restore' });
    expect(log.snapshots[0]!.wordCount).toBe(3);
  });
});
