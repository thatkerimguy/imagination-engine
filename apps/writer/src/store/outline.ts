// Season / chapter outline edits: add, rename, reorder, change status.
import type { ChapterDocument, ChapterStatus, SeasonManifest } from '@kn/core';
import { NotFoundError } from './errors.ts';
import { newSlugId } from './ids.ts';
import type { NovelRepository } from './repository.ts';

export function moveItem<T>(list: readonly T[], item: T, delta: -1 | 1): T[] {
  const i = list.indexOf(item);
  const j = i + delta;
  if (i === -1 || j < 0 || j >= list.length) return [...list];
  const out = [...list];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

async function requireSeason(repo: NovelRepository, novelId: string, seasonId: string) {
  const season = await repo.getSeason(novelId, seasonId);
  if (!season) throw new NotFoundError(`Season ${seasonId}`);
  return season;
}

async function requireChapter(
  repo: NovelRepository,
  novelId: string,
  seasonId: string,
  chapterId: string,
) {
  const chapter = await repo.getChapter(novelId, seasonId, chapterId);
  if (!chapter) throw new NotFoundError(`Chapter ${chapterId}`);
  return chapter;
}

export async function addSeason(
  repo: NovelRepository,
  novelId: string,
  title?: string,
): Promise<SeasonManifest> {
  const novel = await repo.requireNovel(novelId);
  const season: SeasonManifest = {
    id: newSlugId(),
    title: title?.trim() || `${novel.sectionLabel} ${novel.seasons.length + 1}`,
    chapters: [],
  };
  await repo.saveSeason(novelId, season);
  await repo.saveNovel({ ...novel, seasons: [...novel.seasons, season.id] });
  return season;
}

export async function renameSeason(
  repo: NovelRepository,
  novelId: string,
  seasonId: string,
  title: string,
): Promise<void> {
  const season = await requireSeason(repo, novelId, seasonId);
  await repo.saveSeason(novelId, { ...season, title: title.trim() });
}

export async function moveSeason(
  repo: NovelRepository,
  novelId: string,
  seasonId: string,
  delta: -1 | 1,
): Promise<void> {
  const novel = await repo.requireNovel(novelId);
  await repo.saveNovel({ ...novel, seasons: moveItem(novel.seasons, seasonId, delta) });
}

export async function addChapter(
  repo: NovelRepository,
  novelId: string,
  seasonId: string,
  title?: string,
): Promise<ChapterDocument> {
  const season = await requireSeason(repo, novelId, seasonId);
  const chapter: ChapterDocument = {
    id: newSlugId(),
    seasonId,
    title: title?.trim() || `Chapter ${season.chapters.length + 1}`,
    status: 'draft',
    blocks: [],
  };
  await repo.saveChapter(novelId, chapter);
  await repo.saveSeason(novelId, { ...season, chapters: [...season.chapters, chapter.id] });
  return chapter;
}

export async function updateChapterMeta(
  repo: NovelRepository,
  novelId: string,
  seasonId: string,
  chapterId: string,
  patch: { title?: string; status?: ChapterStatus },
): Promise<void> {
  const chapter = await requireChapter(repo, novelId, seasonId, chapterId);
  await repo.saveChapter(novelId, {
    ...chapter,
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...(patch.status ? { status: patch.status } : {}),
  });
}

export async function moveChapter(
  repo: NovelRepository,
  novelId: string,
  seasonId: string,
  chapterId: string,
  delta: -1 | 1,
): Promise<void> {
  const season = await requireSeason(repo, novelId, seasonId);
  await repo.saveSeason(novelId, {
    ...season,
    chapters: moveItem(season.chapters, chapterId, delta),
  });
}

export const nextStatus = (s: ChapterStatus): ChapterStatus =>
  s === 'draft' ? 'unlisted' : s === 'unlisted' ? 'published' : 'draft';
