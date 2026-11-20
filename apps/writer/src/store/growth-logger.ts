// Feeds the Growth charts from the editor: after an auto-save flush, snapshot the chapter's
// counts (and the whole novel's) — throttled to one stored point per 5 minutes per target.
import type { ChapterDocument } from '@kn/core';
import { analyzeDocument } from '../analysis/realtime.ts';
import { keys } from './documents.ts';
import { recordGrowth, type GrowthCounts } from './growth-store.ts';
import type { NovelRepository } from './repository.ts';

export function countsOf(chapter: ChapterDocument): GrowthCounts {
  const m = analyzeDocument(chapter.blocks);
  return { chars: m.chars, words: m.words, sentences: m.sentences, paragraphs: m.paragraphs };
}

async function novelCounts(
  repo: NovelRepository,
  novelId: string,
  current: ChapterDocument,
): Promise<GrowthCounts> {
  const total: GrowthCounts = countsOf(current);
  for (const key of await repo.docs.keys(keys.chaptersOf(novelId))) {
    if (key.endsWith(`/${current.seasonId}/${current.id}`)) continue;
    const stored = await repo.docs.read<ChapterDocument>(key);
    if (!stored) continue;
    const c = countsOf(stored.data);
    total.chars += c.chars;
    total.words += c.words;
    total.sentences += c.sentences;
    total.paragraphs += c.paragraphs;
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
