import {
  catalogToTrack,
  publishability,
  searchAudius,
  searchJamendo,
  searchOpenverse,
  type CatalogProvider,
  type CatalogTrack,
} from '@ie/audio';
import { createId } from '@ie/core';
import { readPref, writePref } from '@ie/ui-kit';
import { Pause, Play, Plus, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { addTrack, engine } from '../audio/studio-audio.ts';
import { Segmented } from '../components/Segmented.tsx';
import { useT } from '../store.ts';
import { formatTime } from './format.ts';

const PROVIDERS: readonly CatalogProvider[] = ['openverse', 'audius', 'jamendo'];
const JAMENDO_KEY = 'ie.studio.jamendoClientId';

function search(
  provider: CatalogProvider,
  query: string,
  signal: AbortSignal,
): Promise<CatalogTrack[]> {
  if (provider === 'audius') return searchAudius(query, signal);
  if (provider === 'jamendo') return searchJamendo(query, readPref(JAMENDO_KEY) ?? '', signal);
  return searchOpenverse(query, 'music', signal);
}

type Status = 'idle' | 'loading' | 'done' | 'error';

/** Finds music in free catalogues; adding a result also starts its beat analysis. */
export function CatalogSearch({ onAdded }: { readonly onAdded: (id: string) => void }) {
  const t = useT();
  const [provider, setProvider] = useState<CatalogProvider>('openverse');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogTrack[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [jamendoId, setJamendoId] = useState(() => readPref(JAMENDO_KEY) ?? '');
  const [listening, setListening] = useState<string | null>(null);
  const preview = useRef<HTMLAudioElement | null>(null);
  const pending = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      pending.current?.abort();
      preview.current?.pause();
    },
    [],
  );

  const run = async () => {
    if (!query.trim()) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setStatus('loading');
    try {
      setResults(await search(provider, query.trim(), controller.signal));
      setStatus('done');
    } catch (error) {
      if (controller.signal.aborted) return;
      console.warn(error);
      setStatus('error');
    }
  };

  const listen = (found: CatalogTrack) => {
    const audio = (preview.current ??= new Audio());
    if (listening === found.id) {
      audio.pause();
      return setListening(null);
    }
    audio.src = found.streamUrl;
    audio.volume = engine.level('music');
    audio.onended = () => setListening(null);
    void audio.play().catch(() => setListening(null));
    setListening(found.id);
  };

  const needsKey = provider === 'jamendo' && !jamendoId;

  return (
    <div className="catalog" data-testid="catalog">
      <Segmented
        label={t('sound.catalogue')}
        value={provider}
        options={PROVIDERS.map((p) => ({ value: p, label: t(`sound.provider.${p}`) }))}
        onChange={(p) => {
          setProvider(p);
          setResults([]);
          setStatus('idle');
        }}
      />
      <p className="hint">{t(`sound.providerHint.${provider}`)}</p>
      {provider === 'jamendo' && (
        <label className="labelled">
          <span className="ie-label">{t('sound.jamendoId')}</span>
          <input
            className="field field--mono"
            value={jamendoId}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setJamendoId(e.target.value.trim());
              writePref(JAMENDO_KEY, e.target.value.trim());
            }}
          />
        </label>
      )}
      <form
        className="catalog__search"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <input
          className="field"
          type="search"
          value={query}
          placeholder={t('sound.searchPlaceholder')}
          aria-label={t('sound.search')}
          data-testid="catalog-query"
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="ie-button" disabled={needsKey || status === 'loading'}>
          <Search size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('sound.search')}
        </button>
      </form>
      {status === 'loading' && <p className="hint">{t('sound.searching')}</p>}
      {status === 'error' && (
        <p className="hint" data-error>
          {t('sound.searchFailed')}
        </p>
      )}
      {status === 'done' && results.length === 0 && <p className="hint">{t('sound.noResults')}</p>}
      <ul className="catalog__results">
        {results.map((found) => (
          <li key={found.id} className="catalog__result" data-testid="catalog-result">
            <button
              type="button"
              className="ie-button ie-button--quiet"
              aria-label={listening === found.id ? t('sound.stop') : t('sound.listen')}
              onClick={() => listen(found)}
            >
              {listening === found.id ? (
                <Pause size={16} strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Play size={16} strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>
            <span className="catalog__name">
              <span>{found.title}</span>
              <span className="hint">
                {[
                  found.artist,
                  found.duration ? formatTime(found.duration) : '',
                  t(`sound.licence.${publishability(found.license.code)}`),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <button
              type="button"
              className="ie-button"
              data-testid="catalog-add"
              onClick={() => {
                const track = catalogToTrack(found, createId('t'));
                addTrack(track);
                onAdded(track.id);
              }}
            >
              <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
              {t('sound.add')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
