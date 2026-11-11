import { Download, RefreshCw } from 'lucide-react';
import { Segmented } from '../components/Segmented.tsx';
import { useStudio, useT } from '../store.ts';
import { labelText } from '../write/edit.ts';
import { openFromSync, setSyncEnabled, syncNow, useSync } from './run.ts';

/** Settings → Device sync (ADR 0024). */
export function SyncSection() {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const sync = useSync();
  const time = sync.lastSync
    ? new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(sync.lastSync)
    : null;
  const status =
    sync.state === 'off'
      ? t('sync.off')
      : sync.state === 'syncing'
        ? t('sync.syncing')
        : sync.state === 'unavailable'
          ? t('sync.unavailable')
          : sync.state === 'error'
            ? t('sync.error')
            : time
              ? t(sync.conflicts > 0 ? 'sync.doneConflicts' : 'sync.done', {
                  time,
                  count: sync.conflicts,
                })
              : t('sync.ready');

  return (
    <div className="ie-field sync" data-testid="sync">
      <span className="ie-label">{t('sync.title')}</span>
      <p className="sync__intro">{t('sync.intro')}</p>
      <div className="row row--wrap">
        <Segmented
          label={t('sync.title')}
          options={[
            { value: 'off', label: t('settings.off') },
            { value: 'on', label: t('settings.on') },
          ]}
          value={sync.enabled ? 'on' : 'off'}
          onChange={(v) => setSyncEnabled(v === 'on')}
        />
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-testid="sync-now"
          disabled={!sync.enabled || sync.state === 'syncing'}
          onClick={() => void syncNow()}
        >
          <RefreshCw size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('sync.now')}
        </button>
      </div>
      <p className="sync__status" role="status" data-testid="sync-status">
        {status}
      </p>
      {sync.elsewhere.length > 0 && (
        <div className="sync__elsewhere">
          <span className="ie-label">{t('sync.elsewhere')}</span>
          <ul className="sync__list" data-testid="sync-elsewhere">
            {sync.elsewhere.map((r) => (
              <li key={r.id} className="row">
                <span className="sync__name">{labelText(r.title, locale, r.id)}</span>
                <button
                  type="button"
                  className="ie-button ie-button--quiet"
                  data-testid="sync-open"
                  onClick={() => void openFromSync(r.id)}
                >
                  <Download size={16} strokeWidth={1.5} aria-hidden="true" />
                  {t('sync.open')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
