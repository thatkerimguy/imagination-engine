import { describe, expect, it } from 'vitest';
import { getWriterModule, moduleOutlineLabel } from '../modules/registry.ts';
import { createMemoryDatabase } from '../db/memory-driver.ts';
import {
  addChapter,
  addSeason,
  moveChapter,
  moveItem,
  moveSeason,
  nextStatus,
  renameSeason,
  updateChapterMeta,
} from './outline.ts';
import { NovelRepository } from './repository.ts';

async function setup() {
  const repo = new NovelRepository(createMemoryDatabase());
  const novel = await repo.createNovel({ title: 'T', author: 'A', sectionLabel: 'Arc' });
  return { repo, novelId: novel.id, seasonId: novel.seasons[0]! };
}

describe('seasons', () => {
  it('addSeason defaults the title to sectionLabel + number', async () => {
    const { repo, novelId } = await setup();
    const s = await addSeason(repo, novelId);
    expect(s.title).toBe('Arc 2');
    expect((await repo.requireNovel(novelId)).seasons).toHaveLength(2);
    expect((await addSeason(repo, novelId, ' Custom ')).title).toBe('Custom');
  });

  it('renameSeason trims and saves', async () => {
    const { repo, novelId, seasonId } = await setup();
    await renameSeason(repo, novelId, seasonId, '  New  ');
    expect((await repo.getSeason(novelId, seasonId))?.title).toBe('New');
  });

  it('moveSeason reorders and no-ops at bounds', async () => {
    const { repo, novelId, seasonId } = await setup();
    const s2 = await addSeason(repo, novelId);
    await moveSeason(repo, novelId, seasonId, -1);
    expect((await repo.requireNovel(novelId)).seasons).toEqual([seasonId, s2.id]);
    await moveSeason(repo, novelId, seasonId, 1);
    expect((await repo.requireNovel(novelId)).seasons).toEqual([s2.id, seasonId]);
    await moveSeason(repo, novelId, seasonId, 1);
    expect((await repo.requireNovel(novelId)).seasons).toEqual([s2.id, seasonId]);
  });
});

describe('chapters', () => {
  it('addChapter appends a draft chapter with a default title', async () => {
    const { repo, novelId, seasonId } = await setup();
    const c = await addChapter(repo, novelId, seasonId);
    expect(c.title).toBe('Chapter 2');
    expect(c.status).toBe('draft');
    expect((await repo.getSeason(novelId, seasonId))?.chapters).toHaveLength(2);
    expect(await repo.getChapter(novelId, seasonId, c.id)).toEqual(c);
  });

  it('updateChapterMeta changes status and title', async () => {
    const { repo, novelId, seasonId } = await setup();
    const [id] = (await repo.getSeason(novelId, seasonId))!.chapters;
    await updateChapterMeta(repo, novelId, seasonId, id!, { status: 'published', title: ' Hi ' });
    expect(await repo.getChapter(novelId, seasonId, id!)).toMatchObject({
      status: 'published',
      title: 'Hi',
    });
    await updateChapterMeta(repo, novelId, seasonId, id!, { status: 'draft' });
    expect((await repo.getChapter(novelId, seasonId, id!))?.title).toBe('Hi');
  });

  it('moveChapter reorders within the season', async () => {
    const { repo, novelId, seasonId } = await setup();
    const c2 = await addChapter(repo, novelId, seasonId);
    const [c1] = (await repo.getSeason(novelId, seasonId))!.chapters;
    await moveChapter(repo, novelId, seasonId, c2.id, -1);
    expect((await repo.getSeason(novelId, seasonId))?.chapters).toEqual([c2.id, c1]);
  });
});

describe('helpers', () => {
  it('nextStatus cycles draft -> unlisted -> published -> draft', () => {
    expect(nextStatus('draft')).toBe('unlisted');
    expect(nextStatus('unlisted')).toBe('published');
    expect(nextStatus('published')).toBe('draft');
  });

  it('moveItem swaps neighbours, no-ops at bounds or for unknown items, never mutates', () => {
    const list = ['a', 'b', 'c'];
    expect(moveItem(list, 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(list, 'b', 1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(list, 'a', -1)).toEqual(list);
    expect(moveItem(list, 'c', 1)).toEqual(list);
    expect(moveItem(list, 'z', 1)).toEqual(list);
    expect(list).toEqual(['a', 'b', 'c']);
  });
});

describe('moduleOutlineLabel (human-readable gimmick entries)', () => {
  const defaults = (id: string): Record<string, unknown> =>
    getWriterModule(id)?.schema.defaults ?? {};
  it('uses the module name plus its card detail instead of the raw id', () => {
    expect(moduleOutlineLabel('core-ambient-bed', defaults('core-ambient-bed'))).toBe(
      'Ambient Bed · Rain',
    );
    const dice = moduleOutlineLabel('bl-dice-3d', defaults('bl-dice-3d'));
    expect(dice.startsWith('3D Dice Throw')).toBe(true);
    expect(dice).not.toContain('bl-dice-3d');
  });
  it('labels every registered module by name, never by id', () => {
    for (const id of ['gits-cyberbrain-chat', 'gits-ghost-whisper', 'pt-gaslight-edit']) {
      const label = moduleOutlineLabel(id, defaults(id));
      expect(label.startsWith(getWriterModule(id)?.meta.name ?? '?')).toBe(true);
      expect(label).not.toContain(id);
    }
  });
  it('falls back to the raw id only for unregistered modules', () => {
    expect(moduleOutlineLabel('xx-unknown', {})).toBe('xx-unknown');
  });
});
