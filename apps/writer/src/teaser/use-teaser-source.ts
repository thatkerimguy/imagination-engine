// Loads what the teaser needs: book title / accent / cover and the chapter to quote from (the
// open chapter, or the first chapter of the novel that has quotable prose).
import type { ChapterDocument } from '@kn/core';
import { useEffect, useState } from 'react';
import { useRepository } from '../store/context.tsx';
import { extractQuoteCandidates } from './teaser-model.ts';

export interface TeaserSource {
  novelId: string;
  bookTitle: string;
  accent?: string;
  coverUri?: string;
  chapter: ChapterDocument | null;
}

export function useTeaserSource(
  visible: boolean,
  novelId: string,
  given?: ChapterDocument,
): TeaserSource | null {
  const repo = useRepository();
  const [source, setSource] = useState<TeaserSource | null>(null);
  useEffect(() => {
    if (!visible) return;
    let live = true;
    void (async () => {
      const novel = (await repo.listNovels()).find((n) => n.id === novelId);
      let chapter: ChapterDocument | null = given ?? null;
      if (!chapter) {
        const bundle = await repo.exportNovel(novelId);
        const all = bundle.seasons.flatMap((s) => s.chapters);
        chapter = all.find((c) => extractQuoteCandidates(c.blocks, 1).length > 0) ?? all[0] ?? null;
      }
      if (live)
        setSource({
          novelId,
          bookTitle: novel?.title ?? '',
          ...(novel?.accent ? { accent: novel.accent } : {}),
          ...(novel?.coverUri ? { coverUri: novel.coverUri } : {}),
          chapter,
        });
    })().catch(() => live && setSource(null));
    return () => {
      live = false;
    };
  }, [visible, repo, novelId, given]);
  return source;
}
