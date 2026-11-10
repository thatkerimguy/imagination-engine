import { LIBRARY_KINDS, type LibraryKind } from '@ie/story';
import { useEffect, useState } from 'react';
import { LibraryList } from '../library/LibraryList.tsx';
import { LibraryPacks } from '../library/LibraryPacks.tsx';
import { LibrarySave } from '../library/LibrarySave.tsx';
import { useLibrary } from '../library/storage.ts';
import type { MessageKey } from '../messages.ts';
import { useT } from '../store.ts';

/** The Library (ADR 0021): reusable pieces shared by every novel on this device, and packs. */
export function LibraryView() {
  const t = useT();
  const items = useLibrary((s) => s.items);
  const loaded = useLibrary((s) => s.loaded);
  const load = useLibrary((s) => s.load);
  const [filter, setFilter] = useState<LibraryKind | 'all'>('all');
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const report = (text: string, error = false) => setStatus({ text, error });

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const shown = filter === 'all' ? items : items.filter((item) => item.kind === filter);

  return (
    <section className="page" data-testid="view-library">
      <h2 className="page__title">{t('view.library')}</h2>
      <p className="page__intro">{t('lib.intro')}</p>
      {status && (
        <p
          className="lib-status"
          role={status.error ? 'alert' : 'status'}
          data-kind={status.error ? 'error' : 'info'}
          data-testid="lib-status"
        >
          {status.text}
        </p>
      )}

      <div className="lib-section">
        <h3>{t('lib.save')}</h3>
        <LibrarySave onStatus={report} />
      </div>

      <div className="lib-section">
        <div className="row row--wrap">
          <h3>{t('lib.items')}</h3>
          <label className="inline-field">
            <span>{t('lib.filter')}</span>
            <select
              className="picker"
              value={filter}
              data-testid="lib-filter"
              onChange={(e) => setFilter(e.target.value as LibraryKind | 'all')}
            >
              <option value="all">{t('lib.all')}</option>
              {LIBRARY_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(`lib.kind.${kind}` as MessageKey)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loaded && (
          <LibraryList
            items={shown}
            emptyText={t(items.length ? 'lib.emptyKind' : 'lib.empty')}
            onStatus={report}
          />
        )}
      </div>

      <div className="lib-section">
        <h3>{t('lib.packs')}</h3>
        <LibraryPacks shown={shown} onStatus={report} />
      </div>
    </section>
  );
}
