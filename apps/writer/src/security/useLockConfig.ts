// Live view of the stored lock config: reloads after every repository change notification.
import { useCallback, useEffect, useState } from 'react';
import { useRepository } from '../store/context.tsx';
import { loadLockConfig, type LockConfig } from './lock.ts';

export interface LockConfigState {
  /** `undefined` until first loaded; `null` when no PIN has been set. */
  config: LockConfig | null | undefined;
  reload(): Promise<LockConfig | null>;
}

export function useLockConfig(): LockConfigState {
  const repo = useRepository();
  const [config, setConfig] = useState<LockConfig | null | undefined>(undefined);
  const reload = useCallback(async () => {
    const c = await loadLockConfig(repo.docs);
    setConfig(c);
    return c;
  }, [repo]);
  useEffect(() => {
    void reload();
    return repo.subscribe(() => void reload());
  }, [repo, reload]);
  return { config, reload };
}
