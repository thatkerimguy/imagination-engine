// Gathers what the home-screen widget shows (recent chapter, today's words, lock state) and pushes
// it. Called on chapter save, on workspace open and whenever the Master Lock config changes.
// Today's words come from relational `growth_logs` with day-0 baselines subtracted, so a fresh
// import or restore never shows its whole length as "written today". Best-effort: never throws.
import { loadLockConfig } from '../security/lock.ts';
import { keys } from '../store/documents.ts';
import { todayWordsForBook } from '../store/growth-store.ts';
import type { NovelRepository } from '../store/repository.ts';
import { pushWidget } from './widget-bridge';
import { buildWidgetPayload, type RecentChapter } from './widget-state.ts';

export const WIDGET_RECENT_KEY = keys.setting('widget-recent');

interface RecentRef {
  novelId: string;
  seasonId: string;
  chapterId: string;
}

/** True when any of the ids is missing, trashed, or under a trashed ancestor. */
async function isHidden(repo: NovelRepository, ids: readonly string[]): Promise<boolean> {
  for (const id of ids) {
    const n = await repo.db.getNode(id);
    if (!n || n.deletedAt) return true;
  }
  return false;
}

async function resolveRecent(
  repo: NovelRepository,
  ref: RecentRef | undefined,
): Promise<{ recent: RecentChapter; itemLocked: boolean } | null> {
  if (!ref) return null;
  const { novelId, seasonId, chapterId } = ref;
  if (await isHidden(repo, [novelId, seasonId, chapterId])) return null;
  const [book, chapter] = await Promise.all([repo.db.getNode(novelId), repo.db.getNode(chapterId)]);
  if (!book || !chapter || chapter.parentId !== seasonId) return null;
  return {
    recent: { ...ref, novelTitle: book.title, chapterTitle: chapter.title },
    itemLocked: book.locked || chapter.locked,
  };
}

/** Rebuilds and pushes the widget; pass `edited` right after a chapter save. */
export async function syncWidget(repo: NovelRepository, edited?: RecentRef): Promise<void> {
  try {
    if (edited) await repo.docs.write(WIDGET_RECENT_KEY, edited);
    const ref = edited ?? (await repo.docs.read<RecentRef>(WIDGET_RECENT_KEY))?.data;
    const lock = await loadLockConfig(repo.docs);
    const resolved = await resolveRecent(repo, ref);
    pushWidget(
      buildWidgetPayload({
        lockEnabled: lock?.enabled === true,
        itemLocked: resolved?.itemLocked,
        recent: resolved?.recent ?? null,
        todayWords: resolved ? await todayWordsForBook(repo, resolved.recent.novelId) : 0,
      }),
    );
  } catch (err) {
    console.warn('[writer] widget sync failed', err);
  }
}
