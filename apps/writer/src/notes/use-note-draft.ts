// Editor state for one standalone note: mirrors useChapterDraft (in-memory draft with undo/redo,
// debounced auto-save, growth logging) but saves a DocRecord. Notes keep the Author's source text,
// writer markup included — nothing is sanitized. The returned shape is a ChapterDraft plus
// `blocks`, `title` and `setTitle`, so every chapter-editor hook accepts it unchanged and a
// version-history or auto-checkpoint hook can read `blocks` / call `update`.
import type { ChapterDocument } from '@kn/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { createAutosaver, type Autosaver } from '../store/autosave.ts';
import { loadChapterStyles, pruneStyles, saveChapterStyles } from '../store/chapter-styles.ts';
import { useRepository } from '../store/context.tsx';
import { fallbackTitle, getDoc, saveDoc, type NoteBlock } from '../store/folders.ts';
import { countsOf } from '../store/growth-logger.ts';
import { recordGrowth } from '../store/growth-store.ts';
import { recordAutoCheckpoint } from '../store/versions.ts';
import { touchOpened } from '../store/item-meta.ts';
import { docAsChapter } from '../store/note-promote.ts';
import type { ChapterDraft, DraftState, EditKind } from '../store/use-chapter-draft.ts';
import type { SaveStatus } from '../store/autosave.ts';

export interface NoteDraft extends ChapterDraft {
  /** Current blocks (`chapter.blocks` without gimmick blocks); `undefined` while loading. */
  blocks: NoteBlock[] | undefined;
  /** The Author's title; `''` means "auto" (first words of the note). */
  title: string;
  /** What the title shows when `title` is empty. */
  autoTitle: string;
  setTitle(title: string): void;
  parentFolderId: string | null;
}

interface Saved {
  draft: DraftState;
  title: string;
}

const BOUNDARY: EditKind = { kind: 'boundary' };
const EMPTY_STYLES: ChapterDraft['styles'] = {};
const isNoteBlock = (b: ChapterDocument['blocks'][number]): b is NoteBlock => b.kind !== 'module';

export function useNoteDraft(docId: string): NoteDraft {
  const repo = useRepository();
  const [history, setHistory] = useState<History<DraftState>>();
  const [error, setError] = useState<unknown>();
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [title, setTitleState] = useState('');
  const [parentFolderId, setParent] = useState<string | null>(null);
  const saver = useRef<Autosaver<Saved> | null>(null);
  const latest = useRef<History<DraftState> | undefined>(undefined);
  const titleRef = useRef('');

  useEffect(() => {
    let live = true;
    let last: DraftState | undefined;
    const s = createAutosaver<Saved>(
      async ({ draft, title: named }) => {
        last = draft;
        const blocks = draft.chapter.blocks.filter(isNoteBlock);
        await saveDoc(repo, docId, { blocks, title: named });
        void recordAutoCheckpoint(repo, `doc:${docId}`, blocks);
        await saveChapterStyles(
          repo,
          docId,
          pruneStyles(
            draft.styles,
            blocks.map((b) => b.id),
          ),
        );
        void recordGrowth(repo, `doc:${docId}`, () => countsOf(draft.chapter)).catch(() => false);
      },
      (next, err) => {
        if (err) console.warn('[writer] note auto-save failed', err);
        if (live) setStatus(next);
      },
    );
    saver.current = s;
    Promise.all([getDoc(repo, docId), loadChapterStyles(repo, docId)]).then(
      ([doc, styles]) => {
        if (!live) return;
        if (!doc) return setError(new Error('Note not found'));
        const named = doc.autoTitle ? '' : doc.title;
        titleRef.current = named;
        setTitleState(named);
        setParent(doc.parentFolderId);
        const h = createHistory<DraftState>({ chapter: docAsChapter(doc), styles });
        latest.current = h;
        setHistory(h);
        void touchOpened(repo, docId);
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
        if (last)
          void recordGrowth(repo, `doc:${docId}`, () => countsOf(last!.chapter), {
            force: true,
          }).catch(() => false);
      });
    };
  }, [repo, docId]);

  const commit = useCallback((next: History<DraftState>) => {
    if (next === latest.current) return;
    latest.current = next;
    setHistory(next);
    saver.current?.schedule({ draft: next.present, title: titleRef.current });
  }, []);

  const apply = useCallback(
    (change: (d: DraftState) => DraftState, edit: EditKind) => {
      const h = latest.current;
      if (!h) return;
      const next = change(h.present);
      if (next === h.present) return;
      commit(pushHistory(h, next, edit.kind === 'typing' ? { ...edit, now: Date.now() } : edit));
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
    (change: (s: DraftState['styles']) => DraftState['styles']) =>
      apply((d) => {
        const styles = change(d.styles);
        return styles === d.styles ? d : { ...d, styles };
      }, BOUNDARY),
    [apply],
  );
  const setTitle = useCallback((next: string) => {
    titleRef.current = next;
    setTitleState(next);
    const h = latest.current;
    if (h) saver.current?.schedule({ draft: h.present, title: next });
  }, []);

  const undo = useCallback(() => latest.current && commit(undoHistory(latest.current)), [commit]);
  const redo = useCallback(() => latest.current && commit(redoHistory(latest.current)), [commit]);
  const flush = useCallback(() => saver.current?.flush() ?? Promise.resolve(), []);
  const chapter = history?.present.chapter;
  const blocks = useMemo(() => chapter?.blocks.filter(isNoteBlock), [chapter]);

  return {
    chapter,
    blocks,
    title,
    autoTitle: fallbackTitle(blocks ?? []),
    setTitle,
    parentFolderId,
    styles: history?.present.styles ?? EMPTY_STYLES,
    error,
    status,
    skipped: [],
    update,
    updateStyles,
    undo,
    redo,
    canUndo: history ? canUndo(history) : false,
    canRedo: history ? canRedo(history) : false,
    flush,
  };
}
