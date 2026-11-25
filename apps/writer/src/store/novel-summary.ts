// Bookshelf row data for one novel: counts, words, accent and the latest edit time.
import type { ChapterDocument, NovelManifest, SectionLabel } from '@kn/core';
import { keys, type DocumentStore, type Stored } from './documents.ts';
import { isChapterKeyTrashed } from './trash-model.ts';
import { chapterWords } from './word-count.ts';

export interface NovelSummary {
  id: string;
  title: string;
  subtitle?: string;
  author: string;
  sectionLabel: SectionLabel;
  seasonCount: number;
  chapterCount: number;
  /** Prose + dialogue words across every chapter. */
  words: number;
  /** The novel's `--accent` theme colour, when set. */
  accent?: string;
  /** Cover art (`meta/item/<id>`), when set. */
  coverUri?: string;
  updatedAt: number;
}

export async function summarizeNovel(
  docs: DocumentStore,
  stored: Stored<NovelManifest>,
  trashed: ReadonlySet<string> = new Set(),
): Promise<NovelSummary> {
  const n = stored.data;
  const chapterKeys = (await docs.keys(keys.chaptersOf(n.id))).filter(
    (k) => !isChapterKeyTrashed(k, trashed),
  );
  let updatedAt = stored.updatedAt;
  let words = 0;
  for (const ck of chapterKeys) {
    const c = await docs.read<ChapterDocument>(ck);
    if (!c) continue;
    if (c.updatedAt > updatedAt) updatedAt = c.updatedAt;
    words += chapterWords(c.data);
  }
  const accent = n.theme['--accent'];
  const cover = (await docs.read<{ coverUri?: unknown }>(`meta/item/${n.id}`))?.data?.coverUri;
  return {
    id: n.id,
    title: n.title,
    ...(n.subtitle ? { subtitle: n.subtitle } : {}),
    author: n.author,
    sectionLabel: n.sectionLabel,
    seasonCount: n.seasons.length,
    chapterCount: chapterKeys.length,
    words,
    ...(accent ? { accent } : {}),
    ...(typeof cover === 'string' && cover ? { coverUri: cover } : {}),
    updatedAt,
  };
}
