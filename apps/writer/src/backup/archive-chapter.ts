// `.knchap` import: adds the chapter to a season under a fresh id (never overwrites a chapter).
import { parseSeasonManifest } from '@kn/core';
import type { StorageAdapter } from '../storage/types.ts';
import { newSlugId } from '../store/ids.ts';
import { parseArchive } from './archive.ts';

interface Stored {
  data: Record<string, unknown>;
  updatedAt: number;
}

export async function restoreChapter(
  adapter: StorageAdapter,
  bytes: Uint8Array,
  target: { novelId: string; seasonId: string },
  now = Date.now(),
): Promise<string> {
  const { entries } = await parseArchive(bytes, 'knchap');
  const chapter = entries.find((e) => e.key.startsWith('chapter/'));
  if (!chapter) throw new Error('A .knchap must contain one chapter.');
  const seasonKey = `season/${target.novelId}/${target.seasonId}`;
  const rawSeason = await adapter.get(seasonKey);
  if (rawSeason === null) throw new Error('That season was not found.');
  const season = JSON.parse(rawSeason) as Stored;
  const oldId = chapter.key.slice(chapter.key.lastIndexOf('/') + 1);
  const id = newSlugId();
  const stored = JSON.parse(chapter.value) as Stored;
  const nextSeason = parseSeasonManifest({
    ...season.data,
    chapters: [...((season.data.chapters as string[] | undefined) ?? []), id],
  });
  if (!nextSeason.ok) throw new Error(`Season: ${nextSeason.errors.join('; ')}`);
  await adapter.set(
    `chapter/${target.novelId}/${target.seasonId}/${id}`,
    JSON.stringify({ ...stored, data: { ...stored.data, id, seasonId: target.seasonId } }),
  );
  for (const e of entries) {
    if (e.key === `meta/chapter-styles/${oldId}`)
      await adapter.set(`meta/chapter-styles/${id}`, e.value);
    if (e.key === `meta/item/${oldId}`) await adapter.set(`meta/item/${id}`, e.value);
  }
  await adapter.set(seasonKey, JSON.stringify({ data: nextSeason.value, updatedAt: now }));
  return id;
}
