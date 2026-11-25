// State for the publish sheet: config, plan, status, and the publish / unpublish actions.
import { useCallback, useEffect, useState } from 'react';
import { useRepository } from '../store/context.tsx';
import {
  clearPublishStatus,
  isPublishConfigured,
  loadPublishConfig,
  loadPublishStatus,
  loadPublishToken,
  type PublishConfig,
  type PublishStatus,
} from './publish-settings.ts';
import {
  inspectNovelForPublish,
  publishNovelToApi,
  unpublishNovelFromApi,
  type PublishPlan,
} from './publish-client.ts';

export interface PublishState {
  ready: boolean | null;
  config: PublishConfig;
  plan: PublishPlan | null;
  status: PublishStatus | null;
  busy: boolean;
  published: string | null;
  error: string | null;
  note: string | null;
  publish(): Promise<boolean>;
  unpublish(): Promise<void>;
}

export function usePublish(
  visible: boolean,
  novelId: string,
  beforePublish?: () => Promise<void>,
): PublishState {
  const repo = useRepository();
  const [ready, setReady] = useState<boolean | null>(null);
  const [config, setConfig] = useState<PublishConfig>({ apiUrl: '', readerUrl: '' });
  const [token, setToken] = useState('');
  const [plan, setPlan] = useState<PublishPlan | null>(null);
  const [status, setStatus] = useState<PublishStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    const [c, t] = await Promise.all([loadPublishConfig(repo), loadPublishToken(repo)]);
    setConfig(c);
    setToken(t);
    setReady(isPublishConfigured(c, t));
    setStatus(await loadPublishStatus(repo, novelId));
    if (isPublishConfigured(c, t)) setPlan(await inspectNovelForPublish(repo, novelId));
  }, [repo, novelId]);

  useEffect(() => {
    if (!visible) return;
    setPublished(null);
    setError(null);
    setNote(null);
    setReady(null);
    void refresh().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [visible, refresh]);

  const publish = async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await beforePublish?.();
      const result = await publishNovelToApi(repo, novelId, config, token);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      setPublished(result.plan.title);
      await refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publishing failed.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await unpublishNovelFromApi(repo, novelId, config, token);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await clearPublishStatus(repo, novelId);
      setStatus(null);
      setPublished(null);
      setNote('Removed from the web. Your book is untouched on this device.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not unpublish.');
    } finally {
      setBusy(false);
    }
  };

  return { ready, config, plan, status, busy, published, error, note, publish, unpublish };
}
