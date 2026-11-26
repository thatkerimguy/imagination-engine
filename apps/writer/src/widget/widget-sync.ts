// Gathers what the home-screen widget shows (recent chapter, today's words, lock state) and pushes
// it. Called on chapter save, on workspace open and whenever the Master Lock config changes.
// Best-effort: never throws, never blocks the caller.
import { loadLockConfig } from '../security/lock.ts';
import { keys } from '../store/documents.ts';
import { loadGrowth } from '../store/growth-store.ts';
import { loadItemMeta } from '../store/item-meta.ts';
import type { NovelRepository } from '../store/repository.ts';
import { trashKey } from '../store/trash-model.ts';
import { pushWidget } from './widget-bridge';
import { buildWidgetPayload, todayWordsFrom, type RecentChapter } from './widget-state.ts';

export const WIDGET_RECENT_KEY = keys.setting('widget-recent');

interface RecentRef {
  novelId: string;
  seasonId: string;
  chapterId: string;
}

async function isTrashed(repo: NovelRepository, ids: readonly string[]): Promise<boolean> {
  for (const id of ids) if (await repo.docs.read(trashKey(id))) return true;
  return false;
}

async function resolveRecent(
  repo: NovelRepository,
  ref: RecentRef | undefined,
): Promise<{ recent: RecentChapter; itemLocked: boolean } | null> {
  if (!ref) return null;
  const { novelId, seasonId, chapterId } = ref;
  if (await isTrashed(repo, [novelId, seasonId, chapterId])) return null;
  const [novel, chapter] = await Promise.all([
    repo.getNovel(novelId),
    repo.getChapter(novelId, seasonId, chapterId),
  ]);
  if (!novel || !chapter) return null;
  const metas = await Promise.all([loadItemMeta(repo, novelId), loadItemMeta(repo, chapterId)]);
  return {
    recent: { ...ref, novelTitle: novel.title, chapterTitle: chapter.title },
    itemLocked: metas.some((m) => m.locked === true),
  };
}

/** Rebuilds and pushes the widget; pass `edited` right after a chapter save. */
export async function syncWidget(repo: NovelRepository, edited?: RecentRef): Promise<void> {
  try {
    if (edited) await repo.docs.write(WIDGET_RECENT_KEY, edited);
    const ref = edited ?? (await repo.docs.read<RecentRef>(WIDGET_RECENT_KEY))?.data;
    const lock = await loadLockConfig(repo.docs);
    const resolved = await resolveRecent(repo, ref);
    const growth = resolved ? await loadGrowth(repo, `novel:${resolved.recent.novelId}`) : null;
    pushWidget(
      buildWidgetPayload({
        lockEnabled: lock?.enabled === true,
        itemLocked: resolved?.itemLocked,
        recent: resolved?.recent ?? null,
        todayWords: growth ? todayWordsFrom(growth.points, Date.now()) : 0,
      }),
    );
  } catch (err) {
    console.warn('[writer] widget sync failed', err);
  }
}
