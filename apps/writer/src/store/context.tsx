// React wiring: one repository per app, plus a query hook that re-runs whenever data changes.
import { useFocusEffect } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { maybeAutoBackup } from '../backup/auto-backup.ts';
import { deleteCoverFiles } from '../media/cover-files';
import { createDefaultAdapter } from '../storage/adapter';
import { syncHapticsPref } from '../ui/haptics.ts';
import { seedOnFirstLaunch } from './demo.ts';
import { NovelRepository } from './repository.ts';
import { purgeExpiredTrash } from './trash.ts';

const RepoContext = createContext<NovelRepository | null>(null);

export function RepositoryProvider({ children }: { children: ReactNode }): ReactNode {
  const [repo] = useState(() => new NovelRepository(createDefaultAdapter()));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    seedOnFirstLaunch(repo)
      .catch((err: unknown) => console.warn('[writer] demo seed failed', err))
      .finally(() => {
        setReady(true);
        void syncHapticsPref(repo);
        // Rotating emergency snapshot when the configured interval has passed (native only).
        void maybeAutoBackup(repo);
        // Items in Trash for 30+ days are deleted for good, with covers nothing else uses.
        purgeExpiredTrash(repo)
          .then(deleteCoverFiles)
          .catch((err: unknown) => console.warn('[writer] trash purge failed', err));
      });
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
  // Screens stacked behind the active route skip change-driven reloads: they mark themselves
  // dirty and reload once when focus returns.
  const focused = useRef(true);
  const dirty = useRef(false);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      if (dirty.current) {
        dirty.current = false;
        reload();
      }
      return () => {
        focused.current = false;
      };
    }, [reload]),
  );
  useEffect(
    () =>
      repo.subscribe(() => {
        if (focused.current) reload();
        else dirty.current = true;
      }),
    [repo, reload],
  );
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
