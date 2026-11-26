import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system', () => ({
  File: class {
    exists = false;
  },
}));

import { createMemoryDatabase } from '../db/memory-driver.ts';
import { listBacklinks } from './backlinks.ts';
import { createDoc, saveDoc } from './folders.ts';
import { addChapter } from './outline.ts';
import { NovelRepository } from './repository.ts';
import { moveToTrash, restoreTrashedItem } from './trash.ts';

const B1 = '01M7WD7TG0SRH8FFJAF28FHTHC';

async function setup() {
  const repo = new NovelRepository(createMemoryDatabase());
  const novel = await repo.createNovel({ title: 'Tide', author: 'A', sectionLabel: 'Season' });
  const season = novel.seasons[0]!;
  const place = await createDoc(repo, null, { title: 'Harbour District', kind: 'location' });
  const ch = await addChapter(repo, novel.id, season, 'Snake Eyes');
  const write = (text: string) =>
    repo.saveChapter(novel.id, { ...ch, blocks: [{ id: B1, kind: 'prose', text }] });
  return { repo, novel: novel.id, season, place, ch, write };
}

describe('backlinks', () => {
  it('lists a chapter that cites a location by wikilink, with navigation ids', async () => {
    const { repo, place, ch, write, novel, season } = await setup();
    await write('She walked down to [[Harbour District]] before dawn.');
    const [b, ...rest] = await listBacklinks(repo, place.id);
    expect(rest).toHaveLength(0);
    expect(b).toMatchObject({
      sourceId: ch.id,
      sourceKind: 'chapter',
      sourceTitle: 'Snake Eyes',
      parentBookTitle: 'Tide',
      bookId: novel,
      seasonId: season,
    });
    expect(b?.excerpt).toContain('Harbour District');
  });

  it('counts aliased wikilinks and @mentions, and drops them when edited out', async () => {
    const { repo, place, write } = await setup();
    await write('Down at [[Harbour District|the quays]] it rained.');
    expect(await listBacklinks(repo, place.id)).toHaveLength(1);
    await write('Down at @Harbour District it rained.');
    expect(await listBacklinks(repo, place.id)).toHaveLength(1);
    await write('Down at the quays it rained.');
    expect(await listBacklinks(repo, place.id)).toHaveLength(0);
  });

  it('hides a trashed citing chapter at once and restores it', async () => {
    const { repo, place, ch, write, novel, season } = await setup();
    await write('See [[Harbour District]].');
    await moveToTrash(repo, {
      kind: 'chapter',
      novelId: novel,
      seasonId: season,
      chapterId: ch.id,
    });
    expect(await listBacklinks(repo, place.id)).toHaveLength(0);
    await restoreTrashedItem(repo, ch.id);
    expect(await listBacklinks(repo, place.id)).toHaveLength(1);
  });

  it('includes notes, skips self-links, sorts by title', async () => {
    const { repo, place, write } = await setup();
    await write('Back to [[Harbour District]].');
    const note = await createDoc(repo, null, { title: 'Aardvark note' });
    await saveDoc(repo, note.id, {
      blocks: [{ id: B1, kind: 'prose', text: '[[Harbour District]]' }],
    });
    await saveDoc(repo, place.id, {
      blocks: [{ id: B1, kind: 'prose', text: '[[Harbour District]]' }],
    });
    const list = await listBacklinks(repo, place.id);
    expect(list.map((b) => b.sourceTitle)).toEqual(['Aardvark note', 'Snake Eyes']);
    expect(list[0]?.sourceKind).toBe('note');
  });
});
