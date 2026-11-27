// Catalog browser state: seeds the catalog, debounced FTS search, genre facets, Favorites, Recent.
import type { GimmickBlueprint } from '@kn/core/gimmicks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CatalogRepository, type CatalogEntry } from '../db/catalog-repo.ts';
import type { CatalogFacet } from '../db/port.ts';
import { useRepository } from '../store/context.tsx';
import { ALL, catalogQuery, genreChips, type GenreChip } from './catalog-model.ts';
import { ensureCatalogSeeded } from './catalog-seed.ts';

export const SEARCH_DEBOUNCE_MS = 120;

export interface CatalogState {
  ready: boolean;
  text: string;
  setText(t: string): void;
  chip: string;
  setChip(c: string): void;
  chips: GenreChip[];
  results: CatalogEntry[];
  recent: GimmickBlueprint[];
  favorites: ReadonlySet<string>;
  toggleFavorite(id: string): void;
  pushRecent(id: string): void;
}

export function useCatalog(enabled: boolean): CatalogState {
  const db = useRepository().db;
  const catalog = useMemo(() => new CatalogRepository(db), [db]);
  const [ready, setReady] = useState(false);
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [chip, setChip] = useState(ALL);
  const [facets, setFacets] = useState<CatalogFacet[]>([]);
  const [favs, setFavs] = useState<string[]>([]);
  const [recent, setRecent] = useState<GimmickBlueprint[]>([]);
  const [results, setResults] = useState<CatalogEntry[]>([]);
  const ticket = useRef(0);

  const refreshMeta = useCallback(async () => {
    const [f, fav, rec] = await Promise.all([
      catalog.genreCounts(),
      catalog.favorites(),
      catalog.recent(),
    ]);
    setFacets(f);
    setFavs(fav);
    setRecent(await catalog.getMany(rec));
  }, [catalog]);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    ensureCatalogSeeded(db)
      .then(refreshMeta)
      .catch((e: unknown) => console.warn('[writer] catalog seed failed', e))
      .finally(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [enabled, db, refreshMeta]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(text), text ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(id);
  }, [text]);

  useEffect(() => {
    if (!ready || !enabled) return;
    const mine = ++ticket.current;
    const q = catalogQuery(debounced, chip, favs);
    const run = q ? catalog.search(q) : Promise.resolve<CatalogEntry[]>([]);
    run.then(
      (r) => mine === ticket.current && setResults(r.filter((e) => e.blueprint)),
      () => undefined,
    );
  }, [ready, enabled, catalog, debounced, chip, favs]);

  const toggleFavorite = useCallback(
    (id: string) => void catalog.toggleFavorite(id).then(() => catalog.favorites().then(setFavs)),
    [catalog],
  );
  const pushRecent = useCallback((id: string) => void catalog.pushRecent(id), [catalog]);
  const total = facets.reduce((n, f) => n + f.count, 0);
  const chips = useMemo(() => genreChips(facets, total, favs.length), [facets, total, favs.length]);
  const favorites = useMemo(() => new Set(favs), [favs]);
  return {
    ready,
    text,
    setText,
    chip,
    setChip,
    chips,
    results,
    recent,
    favorites,
    toggleFavorite,
    pushRecent,
  };
}

/** Resolves a cue's blueprint: starter data synchronously, the catalog when it is not a starter. */
export function useBlueprint(
  id: string | null,
  starter: GimmickBlueprint | null,
): GimmickBlueprint | null {
  const db = useRepository().db;
  const [found, setFound] = useState<GimmickBlueprint | null>(starter);
  useEffect(() => {
    if (!id) return;
    if (starter) return setFound(starter);
    let live = true;
    void new CatalogRepository(db).get(id).then((b) => live && setFound(b));
    return () => {
      live = false;
    };
  }, [id, starter, db]);
  return found;
}
