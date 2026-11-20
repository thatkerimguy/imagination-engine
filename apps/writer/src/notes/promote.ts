// Promote a note to a chapter, then open that chapter.
import { router } from 'expo-router';
import { useCallback } from 'react';
import { routes } from '../routes.ts';
import { useRepository } from '../store/context.tsx';
import { promoteDocToChapter } from '../store/note-promote.ts';
import { useConfirm } from '../ui/ConfirmDialog.tsx';

export function usePromote(): (docId: string, novelId: string, seasonId: string) => Promise<void> {
  const repo = useRepository();
  const confirm = useConfirm();
  return useCallback(
    async (docId, novelId, seasonId) => {
      try {
        const chapter = await promoteDocToChapter(repo, docId, novelId, seasonId);
        router.push(routes.chapter(novelId, seasonId, chapter.id));
      } catch (err) {
        await confirm({
          title: 'Could not promote',
          message: err instanceof Error ? err.message : 'Something went wrong.',
          confirmLabel: 'OK',
        });
      }
    },
    [repo, confirm],
  );
}
