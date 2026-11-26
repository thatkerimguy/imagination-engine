import { describe, expect, it } from 'vitest';
import { createMemoryDatabase } from '../db/memory-driver.ts';
import { DEMO_NOVEL_ID, demoBundle, loadDemoNovel, seedOnFirstLaunch } from './demo.ts';
import { updateChapterMeta } from './outline.ts';
import { NovelRepository } from './repository.ts';

const fresh = () => new NovelRepository(createMemoryDatabase());

describe('demo novel', () => {
  it('demoBundle passes importBundle and returns independent copies', async () => {
    const repo = fresh();
    await repo.importBundle(demoBundle());
    expect((await repo.getNovel(DEMO_NOVEL_ID))?.title).toBe('Chrome Tide');
    const a = demoBundle();
    a.novel.title = 'changed';
    expect(demoBundle().novel.title).toBe('Chrome Tide');
  });

  it('seeds once only and not again after the user deletes it', async () => {
    const repo = fresh();
    expect(await seedOnFirstLaunch(repo)).toBe(true);
    expect(await repo.listNovels()).toHaveLength(1);
    expect(await seedOnFirstLaunch(repo)).toBe(false);
    await repo.deleteNovel(DEMO_NOVEL_ID);
    expect(await seedOnFirstLaunch(repo)).toBe(false);
    expect(await repo.listNovels()).toHaveLength(0);
  });

  it('does not seed when novels already exist', async () => {
    const repo = fresh();
    await repo.createNovel({ title: 'Mine', author: 'Me', sectionLabel: 'Season' });
    expect(await seedOnFirstLaunch(repo)).toBe(false);
    expect((await repo.listNovels()).map((n) => n.title)).toEqual(['Mine']);
  });

  it('loadDemoNovel resets edits', async () => {
    const repo = fresh();
    await repo.importBundle(demoBundle());
    await updateChapterMeta(repo, DEMO_NOVEL_ID, 's01', 'ch01', { title: 'Edited' });
    expect((await repo.getChapter(DEMO_NOVEL_ID, 's01', 'ch01'))?.title).toBe('Edited');
    await loadDemoNovel(repo);
    expect((await repo.getChapter(DEMO_NOVEL_ID, 's01', 'ch01'))?.title).toBe('Snake Eyes');
  });
});
