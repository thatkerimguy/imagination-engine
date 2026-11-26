// Feeds the Growth charts from the editor: after an auto-save flush, snapshot the chapter's
// counts (and the whole book's) — throttled to one stored point per 5 minutes per target.
import type { Block, ChapterDocument } from '@kn/core';
import { analyzeDocument } from '../analysis/realtime.ts';
import { recordGrowth, type GrowthCounts } from './growth-store.ts';
import { parseBlocks } from './node-mapping.ts';
import type { NovelRepository } from './repository.ts';

export function countsOf(chapter: Pick<ChapterDocument, 'blocks'>): GrowthCounts {
  const m = analyzeDocument(chapter.blocks);
  return { chars: m.chars, words: m.words, sentences: m.sentences, paragraphs: m.paragraphs };
}

/** Active chapters of a book (chapter and season not in Trash). */
export async function activeBookChapters(repo: NovelRepository, bookId: string) {
  const seasons = new Set((await repo.children(bookId, 'season')).map((s) => s.id));
  const chapters = await repo.db.listNodes({ bookId, kinds: ['chapter'] });
  return chapters.filter((c) => c.parentId !== null && seasons.has(c.parentId));
}

async function novelCounts(
  repo: NovelRepository,
  novelId: string,
  current: ChapterDocument,
): Promise<GrowthCounts> {
  const total: GrowthCounts = countsOf(current);
  for (const c of await activeBookChapters(repo, novelId)) {
    if (c.id === current.id) continue;
    const n = countsOf({ blocks: parseBlocks<Block>(await repo.db.getBody(c.id)) });
    total.chars += n.chars;
    total.words += n.words;
    total.sentences += n.sentences;
    total.paragraphs += n.paragraphs;
  }
  return total;
}

/** Records chapter + novel growth points. Never throws (growth is best-effort telemetry). */
export async function logChapterGrowth(
  repo: NovelRepository,
  novelId: string,
  chapter: ChapterDocument,
  force = false,
): Promise<void> {
  try {
    await recordGrowth(repo, `chapter:${chapter.id}`, () => countsOf(chapter), { force });
    await recordGrowth(repo, `novel:${novelId}`, () => novelCounts(repo, novelId, chapter), {
      force,
    });
  } catch (err) {
    console.warn('[writer] growth logging failed', err);
  }
}
