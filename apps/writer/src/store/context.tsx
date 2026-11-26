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
import { openDatabase } from '../db/sqlite-driver';
import { deleteCoverFiles } from '../media/cover-files';
import { mediaRoot } from '../media/media-root';
import { syncHapticsPref } from '../ui/haptics.ts';
import { seedOnFirstLaunch } from './demo.ts';
import { NovelRepository } from './repository.ts';
import { purgeExpiredTrash } from './trash.ts';

const RepoContext = createContext<NovelRepository | null>(null);

export function RepositoryProvider({ children }: { children: ReactNode }): ReactNode {
  const [repo, setRepo] = useState<NovelRepository | null>(null);
  useEffect(() => {
    let live = true;
    void openDatabase().then((db) => {
      const r = new NovelRepository(db, Date.now, mediaRoot());
      seedOnFirstLaunch(r)
        .catch((err: unknown) => console.warn('[writer] demo seed failed', err))
        .finally(() => {
          if (live) setRepo(r);
          // Web QA hook (scripts/lib/writer-v2.mjs): only once seeded, and only when the web
          // driver exposed its engine (`kn-writer-v2:qa`).
          if ('__knWriterDb' in globalThis) Object.assign(globalThis, { __knWriterRepo: r });
          onOpened(r);
        });
    });
    return () => {
      live = false;
    };
  }, []);
  return repo ? <RepoContext.Provider value={repo}>{children}</RepoContext.Provider> : null;
}

/** Launch housekeeping once the database is open and seeded. */
function onOpened(repo: NovelRepository): void {
  void syncHapticsPref(repo);
  // Rotating emergency snapshot when the configured interval has passed (native only).
  void maybeAutoBackup(repo);
  // Items in Trash for 30+ days are deleted for good, with covers nothing else uses.
  purgeExpiredTrash(repo)
    .then(deleteCoverFiles)
    .catch((err: unknown) => console.warn('[writer] trash purge failed', err));
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
