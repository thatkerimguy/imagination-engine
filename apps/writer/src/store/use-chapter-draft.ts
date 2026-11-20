// Editor state for one chapter: the in-memory draft (with half-written blocks and writer-only
// markup), its writer-only block styles, per-chapter undo/redo, debounced auto-save (chapter +
// styles sidecar), growth logging, and a live copy for the preview screen.
import type { ChapterDocument } from '@kn/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redo as redoHistory,
  undo as undoHistory,
  type History,
} from '../editor/history.ts';
import { createAutosaver, type Autosaver, type SaveStatus } from './autosave.ts';
import {
  applyRawText,
  captureRawText,
  loadChapterStyles,
  saveChapterStyles,
  type ChapterStyles,
} from './chapter-styles.ts';
import { useRepository } from './context.tsx';
import { logChapterGrowth } from './growth-logger.ts';
import { clearLiveDraft, draftKey, setLiveDraft } from './live-drafts.ts';

export interface DraftState {
  chapter: ChapterDocument;
  styles: ChapterStyles;
}

/** How an edit enters undo history: typing in one block coalesces (800 ms); the rest don't. */
export type EditKind = { kind: 'typing'; blockId: string } | { kind: 'boundary' };

export interface ChapterDraft {
  chapter: ChapterDocument | undefined;
  styles: ChapterStyles;
  error: unknown;
  status: SaveStatus;
  /** Ids of blocks left out of the last save because they are unfinished. */
  skipped: readonly string[];
  update(change: (chapter: ChapterDocument) => ChapterDocument, edit?: EditKind): void;
  updateStyles(change: (styles: ChapterStyles) => ChapterStyles): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
  flush(): Promise<void>;
}

const BOUNDARY: EditKind = { kind: 'boundary' };

export function useChapterDraft(
  novelId: string,
  seasonId: string,
  chapterId: string,
): ChapterDraft {
  const repo = useRepository();
  const key = draftKey(novelId, seasonId, chapterId);
  const [history, setHistory] = useState<History<DraftState>>();
  const [error, setError] = useState<unknown>();
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [skipped, setSkipped] = useState<readonly string[]>([]);
  const saver = useRef<Autosaver<DraftState> | null>(null);
  const latest = useRef<History<DraftState> | undefined>(undefined);

  useEffect(() => {
    let live = true;
    let last: DraftState | undefined;
    const s = createAutosaver<DraftState>(
      async (draft) => {
        last = draft;
        const result = await repo.saveChapter(novelId, draft.chapter);
        await saveChapterStyles(repo, chapterId, captureRawText(draft.chapter, draft.styles));
        if (live) setSkipped(result.skipped);
        void logChapterGrowth(repo, novelId, draft.chapter);
      },
      (next, err) => {
        if (err) console.warn('[writer] auto-save failed', err);
        if (live) setStatus(next);
      },
    );
    saver.current = s;
    Promise.all([
      repo.getChapter(novelId, seasonId, chapterId),
      loadChapterStyles(repo, chapterId),
    ]).then(
      ([c, styles]) => {
        if (!live) return;
        if (!c) return setError(new Error('Chapter not found'));
        const h = createHistory<DraftState>({ chapter: applyRawText(c, styles), styles });
        latest.current = h;
        setLiveDraft(key, h.present.chapter);
        setHistory(h);
      },
      (err: unknown) => live && setError(err),
    );
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void s.flush();
    });
    return () => {
      live = false;
      sub.remove();
      void s.flush().finally(() => {
        s.dispose();
        if (last) void logChapterGrowth(repo, novelId, last.chapter, true);
      });
      clearLiveDraft(key);
    };
  }, [repo, novelId, seasonId, chapterId, key]);

  const commit = useCallback(
    (next: History<DraftState>) => {
      if (next === latest.current) return;
      latest.current = next;
      setLiveDraft(key, next.present.chapter);
      setHistory(next);
      saver.current?.schedule(next.present);
    },
    [key],
  );

  const apply = useCallback(
    (change: (d: DraftState) => DraftState, edit: EditKind) => {
      const h = latest.current;
      if (!h) return;
      const next = change(h.present);
      if (next === h.present) return;
      const e = edit.kind === 'typing' ? { ...edit, now: Date.now() } : edit;
      commit(pushHistory(h, next, e));
    },
    [commit],
  );

  const update = useCallback(
    (change: (c: ChapterDocument) => ChapterDocument, edit: EditKind = BOUNDARY) =>
      apply((d) => {
        const chapter = change(d.chapter);
        return chapter === d.chapter ? d : { ...d, chapter };
      }, edit),
    [apply],
  );

  const updateStyles = useCallback(
    (change: (s: ChapterStyles) => ChapterStyles) =>
      apply((d) => {
        const styles = change(d.styles);
        return styles === d.styles ? d : { ...d, styles };
      }, BOUNDARY),
    [apply],
  );

  const undo = useCallback(() => latest.current && commit(undoHistory(latest.current)), [commit]);
  const redo = useCallback(() => latest.current && commit(redoHistory(latest.current)), [commit]);
  const flush = useCallback(() => saver.current?.flush() ?? Promise.resolve(), []);

  return {
    chapter: history?.present.chapter,
    styles: history?.present.styles ?? EMPTY_STYLES,
    error,
    status,
    skipped,
    update,
    updateStyles,
    undo,
    redo,
    canUndo: history ? canUndo(history) : false,
    canRedo: history ? canRedo(history) : false,
    flush,
  };
}

const EMPTY_STYLES: ChapterStyles = {};
