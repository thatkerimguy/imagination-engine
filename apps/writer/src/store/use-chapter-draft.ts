// Editor state for one chapter: the in-memory draft (with half-written blocks), debounced
// auto-save through the repository, and a live copy for the preview screen.
import type { ChapterDocument } from '@kn/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createAutosaver, type Autosaver, type SaveStatus } from './autosave.ts';
import { useRepository } from './context.tsx';
import { clearLiveDraft, draftKey, setLiveDraft } from './live-drafts.ts';

export interface ChapterDraft {
  chapter: ChapterDocument | undefined;
  error: unknown;
  status: SaveStatus;
  /** Ids of blocks left out of the last save because they are unfinished. */
  skipped: readonly string[];
  update(change: (chapter: ChapterDocument) => ChapterDocument): void;
  flush(): Promise<void>;
}

export function useChapterDraft(
  novelId: string,
  seasonId: string,
  chapterId: string,
): ChapterDraft {
  const repo = useRepository();
  const key = draftKey(novelId, seasonId, chapterId);
  const [chapter, setChapter] = useState<ChapterDocument>();
  const [error, setError] = useState<unknown>();
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [skipped, setSkipped] = useState<readonly string[]>([]);
  const saver = useRef<Autosaver<ChapterDocument> | null>(null);
  const latest = useRef<ChapterDocument | undefined>(undefined);

  useEffect(() => {
    let live = true;
    const s = createAutosaver<ChapterDocument>(
      async (draft) => {
        const result = await repo.saveChapter(novelId, draft);
        if (live) setSkipped(result.skipped);
      },
      (next, err) => {
        if (err) console.warn('[writer] auto-save failed', err);
        if (live) setStatus(next);
      },
    );
    saver.current = s;
    repo.getChapter(novelId, seasonId, chapterId).then(
      (c) => {
        if (!live) return;
        if (!c) return setError(new Error('Chapter not found'));
        latest.current = c;
        setLiveDraft(key, c);
        setChapter(c);
      },
      (err: unknown) => live && setError(err),
    );
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void s.flush();
    });
    return () => {
      live = false;
      sub.remove();
      void s.flush().finally(() => s.dispose());
      clearLiveDraft(key);
    };
  }, [repo, novelId, seasonId, chapterId, key]);

  const update = useCallback(
    (change: (c: ChapterDocument) => ChapterDocument) => {
      const current = latest.current;
      if (!current) return;
      const next = change(current);
      if (next === current) return;
      latest.current = next;
      setLiveDraft(key, next);
      setChapter(next);
      saver.current?.schedule(next);
    },
    [key],
  );

  const flush = useCallback(() => saver.current?.flush() ?? Promise.resolve(), []);

  return { chapter, error, status, skipped, update, flush };
}
