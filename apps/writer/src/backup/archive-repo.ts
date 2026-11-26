// Repository-level entry points for backup archives (what the UI and exporters import).
import { coverArchiveMedia } from '../media/cover-archive.ts';
import type { NovelRepository } from '../store/repository.ts';
import { restoreChapter } from './archive-chapter.ts';
import { packNovel, restoreNovel } from './archive-book.ts';
import {
  packWorkspace,
  parseArchive,
  restoreWorkspace,
  type ArchiveManifest,
  type RestoreSummary,
} from './archive.ts';

export const exportNovelArchive = (repo: NovelRepository, novelId: string): Promise<Uint8Array> =>
  packNovel(repo, novelId, Date.now(), coverArchiveMedia);

export const exportWorkspaceArchive = (repo: NovelRepository): Promise<Uint8Array> =>
  packWorkspace(repo, Date.now(), coverArchiveMedia);

/** Validates an archive without writing and reports what it is (for a confirm dialog). */
export async function peekArchive(bytes: Uint8Array): Promise<ArchiveManifest> {
  return (await parseArchive(bytes)).manifest;
}

/** Restores a workspace `.zip` (replace everything) or a `.knbook` (adds the book). */
export async function restoreArchive(
  repo: NovelRepository,
  bytes: Uint8Array,
): Promise<RestoreSummary> {
  const { kind } = await peekArchive(bytes);
  if (kind === 'knchap')
    throw new Error('Chapter files are added from a book: open it and choose Import.');
  return kind === 'workspace'
    ? restoreWorkspace(repo, bytes, coverArchiveMedia)
    : restoreNovel(repo, bytes, coverArchiveMedia);
}

export const importChapterArchive = (
  repo: NovelRepository,
  bytes: Uint8Array,
  target: { novelId: string; seasonId: string },
): Promise<string> => restoreChapter(repo, bytes, target);
