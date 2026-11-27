// Loads a book's Visual DNA through the repository and exposes a saver and live resolver.
import type { BookVisualDna, DnaTheme, ResolvedVisualDna } from '@kn/core/dna';
import { resolveVisualDna } from '@kn/core/dna';
import { useCallback, useMemo } from 'react';
import { useRepoQuery, useRepository } from '../store/context.tsx';
import { dnaFromNovel, serializeDna } from './dna-store.ts';

export function useBookDna(novelId: string): {
  dna: BookVisualDna | null;
  resolve(theme: DnaTheme): ResolvedVisualDna | null;
  save(next: BookVisualDna): Promise<void>;
} {
  const repo = useRepository();
  const { data } = useRepoQuery(`book-dna:${novelId}`, async (r) => r.requireNovel(novelId));
  const dna = useMemo(() => (data ? dnaFromNovel(data) : null), [data]);
  const resolve = useCallback(
    (theme: DnaTheme) => (dna ? resolveVisualDna(dna, theme) : null),
    [dna],
  );
  const save = useCallback(
    async (next: BookVisualDna) => {
      const novel = await repo.requireNovel(novelId);
      await repo.saveNovel({ ...novel, visualDna: serializeDna(next) });
    },
    [repo, novelId],
  );
  return { dna, resolve, save };
}
