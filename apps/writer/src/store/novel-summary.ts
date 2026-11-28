// Bookshelf row data for each active book: counts, words, accent, cover and latest edit time —
// straight from node rows (word counts are maintained on every chapter save; no body reads).
import type { NodeRecord, SectionLabel } from '@kn/core';
import { coverUriOf } from './covers.ts';
import { ms, toManifest } from './node-mapping.ts';
import type { NovelRepository } from './repository.ts';

export interface NovelSummary {
  id: string;
  title: string;
  subtitle?: string;
  author: string;
  sectionLabel: SectionLabel;
  seasonCount: number;
  chapterCount: number;
  /** Prose + dialogue words across every active chapter. */
  words: number;
  /** The novel's `--accent` theme colour, when set. */
  accent?: string;
  /** Cover art (`media_assets` via `nodes.cover_asset_id`), when set. */
  coverUri?: string;
  updatedAt: number;
}

export async function summarizeNovel(
  repo: NovelRepository,
  book: NodeRecord,
): Promise<NovelSummary> {
  const seasons = await repo.children(book.id, 'season');
  const active = new Set(seasons.map((s) => s.id));
  const chapters = (await repo.db.listNodes({ bookId: book.id, kinds: ['chapter'] })).filter(
    (c) => c.parentId !== null && active.has(c.parentId),
  );
  const n = toManifest(
    book,
    seasons.map((s) => s.id),
  );
  let updatedAt = ms(book.updatedAt);
  let words = 0;
  for (const c of chapters) {
    updatedAt = Math.max(updatedAt, ms(c.updatedAt));
    words += c.wordCount;
  }
  const accent = n.theme['--accent'];
  const coverUri = await coverUriOf(repo, book);
  return {
    id: n.id,
    title: n.title,
    ...(n.subtitle ? { subtitle: n.subtitle } : {}),
    author: n.author,
    sectionLabel: n.sectionLabel,
    seasonCount: seasons.length,
    chapterCount: chapters.length,
    words,
    ...(accent ? { accent } : {}),
    ...(coverUri ? { coverUri } : {}),
    updatedAt,
  };
}

/** Summaries of the given books, most recently edited first. */
export async function summarizeNovels(
  repo: NovelRepository,
  books: readonly NodeRecord[],
): Promise<NovelSummary[]> {
  const out: NovelSummary[] = [];
  for (const b of books) out.push(await summarizeNovel(repo, b));
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}
