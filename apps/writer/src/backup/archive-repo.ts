// Repository-level wrappers: backup archives need the raw key-value adapter, which the
// DocumentStore keeps private; this is the one place that reaches for it.
import { coverArchiveMedia } from '../media/cover-archive.ts';
import type { StorageAdapter } from '../storage/types.ts';
import type { NovelRepository } from '../store/repository.ts';
import {
  packNovel,
  packWorkspace,
  restoreNovel,
  restoreWorkspace,
  parseArchive,
  type ArchiveManifest,
  type RestoreSummary,
} from './archive.ts';
import { restoreChapter } from './archive-chapter.ts';

export function rawAdapter(repo: NovelRepository): StorageAdapter {
  const adapter = (repo.docs as unknown as { adapter?: StorageAdapter }).adapter;
  if (!adapter || typeof adapter.get !== 'function') throw new Error('Storage is not available.');
  return adapter;
}

export const exportNovelArchive = (repo: NovelRepository, novelId: string): Promise<Uint8Array> =>
  packNovel(rawAdapter(repo), novelId);

export const exportWorkspaceArchive = (repo: NovelRepository): Promise<Uint8Array> =>
  packWorkspace(rawAdapter(repo), Date.now(), coverArchiveMedia);

/** Validates an archive without writing and reports what it is (for a confirm dialog). */
export async function peekArchive(bytes: Uint8Array): Promise<ArchiveManifest> {
  return (await parseArchive(bytes)).manifest;
}

/** Restores a workspace `.zip` (replace) or a `.knbook` (add / overwrite one book). */
export async function restoreArchive(
  repo: NovelRepository,
  bytes: Uint8Array,
): Promise<RestoreSummary> {
  const { kind } = await peekArchive(bytes);
  if (kind === 'knchap')
    throw new Error('Chapter files are added from a book: open it and choose Import.');
  const summary =
    kind === 'workspace'
      ? await restoreWorkspace(rawAdapter(repo), bytes, coverArchiveMedia)
      : await restoreNovel(rawAdapter(repo), bytes);
  repo.notifyChanged();
  return summary;
}

export async function importChapterArchive(
  repo: NovelRepository,
  bytes: Uint8Array,
  target: { novelId: string; seasonId: string },
): Promise<string> {
  const id = await restoreChapter(rawAdapter(repo), bytes, target);
  repo.notifyChanged();
  return id;
}
