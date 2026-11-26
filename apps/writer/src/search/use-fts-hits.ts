// The FTS5 gate for Search: node ids whose title / plain text match the query in `nodes_fts`
// (token prefixes, "quoted phrases", accent-folded; trashed nodes never indexed). The in-memory
// index then ranks, excerpts and highlights only those nodes. `null` until the first answer.
import { useEffect, useState } from 'react';
import { useRepository } from '../store/context.tsx';

export const FTS_CANDIDATES = 500;

/** Query text for the excerpt ranker: quotes dropped (it matches every word anyway). */
export const rankerQuery = (q: string): string => q.replace(/"/g, ' ');

export function useFtsHits(query: string): ReadonlySet<string> | null {
  const repo = useRepository();
  const [hits, setHits] = useState<ReadonlySet<string> | null>(null);
  useEffect(() => {
    let live = true;
    if (!query.trim()) {
      setHits(new Set());
      return;
    }
    repo.db.search(query, { limit: FTS_CANDIDATES }).then(
      (rows) => live && setHits(new Set(rows.map((r) => r.nodeId))),
      () => live && setHits(new Set()),
    );
    return () => {
      live = false;
    };
  }, [repo, query]);
  return hits;
}
