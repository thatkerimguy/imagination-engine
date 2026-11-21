// State + actions behind the Book Compiler screen.
import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_EXPORT_OPTIONS,
  type ExportFormat,
  type ExportOptions,
} from '../export/book-model.ts';
import { compileFolder, compileNovel, exportBook } from '../export/compile-book.ts';
import { listFolderNotes, listNovelEntries, type CompileEntry } from '../export/compile-source.ts';
import { pickCoverImage } from '../media/pick-cover.ts';
import { getFolder } from '../store/folders.ts';
import { loadItemMeta, updateItemMeta } from '../store/item-meta.ts';
import { useRepository } from '../store/context.tsx';

export type CompileSource =
  { kind: 'novel'; novelId: string } | { kind: 'folder'; folderId: string };

export interface CompileRow extends CompileEntry {
  included: boolean;
}

export interface CompilerState {
  loading: boolean;
  missing: boolean;
  title: string;
  author: string;
  coverUri?: string;
  rows: CompileRow[];
  opts: ExportOptions;
  busy: ExportFormat | null;
  error: string | null;
  notice: string | null;
}

const INITIAL: CompilerState = {
  loading: true,
  missing: false,
  title: '',
  author: '',
  rows: [],
  opts: DEFAULT_EXPORT_OPTIONS,
  busy: null,
  error: null,
  notice: null,
};

const message = (err: unknown): string =>
  err instanceof Error ? err.message : 'Something went wrong. Please try again.';

export function useCompiler(source: CompileSource) {
  const repo = useRepository();
  const itemId = source.kind === 'novel' ? source.novelId : source.folderId;
  const [state, setState] = useState<CompilerState>(INITIAL);
  const patch = useCallback((p: Partial<CompilerState>) => setState((s) => ({ ...s, ...p })), []);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const meta = await loadItemMeta(repo, itemId);
        const head =
          source.kind === 'novel'
            ? await repo
                .requireNovel(source.novelId)
                .then((n) => ({ title: n.title, author: n.author }))
            : await getFolder(repo, source.folderId).then((f) =>
                f ? { title: f.title, author: '' } : null,
              );
        const entries =
          source.kind === 'novel'
            ? await listNovelEntries(repo, source.novelId)
            : await listFolderNotes(repo, source.folderId);
        if (!live) return;
        if (!head) return patch({ loading: false, missing: true });
        patch({
          loading: false,
          ...head,
          ...(meta.coverUri ? { coverUri: meta.coverUri } : {}),
          rows: entries.map((e) => ({ ...e, included: true })),
        });
      } catch {
        if (live) patch({ loading: false, missing: true });
      }
    })();
    return () => {
      live = false;
    };
  }, [repo, itemId, source.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleRow = (id: string): void =>
    setState((s) => ({
      ...s,
      rows: s.rows.map((r) => (r.id === id ? { ...r, included: !r.included } : r)),
    }));

  const moveRow = (id: string, delta: -1 | 1): void =>
    setState((s) => {
      const i = s.rows.findIndex((r) => r.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= s.rows.length) return s;
      const rows = [...s.rows];
      [rows[i], rows[j]] = [rows[j]!, rows[i]!];
      return { ...s, rows };
    });

  const setOpt = <K extends keyof ExportOptions>(key: K, value: ExportOptions[K]): void =>
    setState((s) => ({ ...s, opts: { ...s.opts, [key]: value } }));

  const changeCover = async (): Promise<void> => {
    try {
      const uri = await pickCoverImage();
      if (!uri) return;
      await updateItemMeta(repo, itemId, { coverUri: uri });
      patch({ coverUri: uri });
    } catch (err) {
      patch({ error: message(err) });
    }
  };

  const run = async (format: ExportFormat): Promise<void> => {
    const order = state.rows.filter((r) => r.included).map((r) => r.id);
    if (order.length === 0 && format !== 'knbook')
      return patch({ error: 'Select at least one chapter to export.' });
    patch({ busy: format, error: null, notice: null });
    try {
      const book =
        source.kind === 'novel'
          ? await compileNovel(repo, source.novelId, { order })
          : await compileFolder(repo, source.folderId, { order });
      const out = await exportBook(book, format, state.opts, {
        repo,
        ...(source.kind === 'novel' ? { novelId: source.novelId } : {}),
      });
      if (out.status === 'saved') patch({ notice: `Saved ${out.filename}` });
    } catch (err) {
      patch({ error: message(err) });
    } finally {
      patch({ busy: null });
    }
  };

  return { state, toggleRow, moveRow, setOpt, changeCover, run };
}
