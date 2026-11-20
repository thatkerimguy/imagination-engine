// React wiring: one repository per app, plus a query hook that re-runs whenever data changes.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createDefaultAdapter } from '../storage/adapter';
import { seedOnFirstLaunch } from './demo.ts';
import { NovelRepository } from './repository.ts';

const RepoContext = createContext<NovelRepository | null>(null);

export function RepositoryProvider({ children }: { children: ReactNode }): ReactNode {
  const [repo] = useState(() => new NovelRepository(createDefaultAdapter()));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    seedOnFirstLaunch(repo)
      .catch((err: unknown) => console.warn('[writer] demo seed failed', err))
      .finally(() => setReady(true));
  }, [repo]);
  return ready ? <RepoContext.Provider value={repo}>{children}</RepoContext.Provider> : null;
}

export function useRepository(): NovelRepository {
  const repo = useContext(RepoContext);
  if (!repo) throw new Error('useRepository() needs <RepositoryProvider>');
  return repo;
}

export interface QueryState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload(): void;
}

/**
 * Runs `load` now and after every repository write. Pass a stable `key` (e.g. the route ids);
 * changing it reloads. Stale responses are ignored.
 */
export function useRepoQuery<T>(
  key: string,
  load: (repo: NovelRepository) => Promise<T>,
): QueryState<T> {
  const repo = useRepository();
  const [state, setState] = useState<{ data?: T; error?: unknown; loading: boolean }>({
    loading: true,
  });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => repo.subscribe(reload), [repo, reload]);
  useEffect(() => {
    let live = true;
    load(repo).then(
      (data) => live && setState({ data, loading: false }),
      (error: unknown) => live && setState({ error, loading: false }),
    );
    return () => {
      live = false;
    };
    // `load` is intentionally keyed by `key` so callers can pass inline closures.
  }, [repo, key, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data: state.data, error: state.error, loading: state.loading, reload };
}
