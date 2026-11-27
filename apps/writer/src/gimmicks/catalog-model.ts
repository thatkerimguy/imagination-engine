// Pure catalog browser model: genre chips, facet ordering and the query a chip + text produce.
import type { CatalogFacet, CatalogQuery } from '../db/port.ts';

export const FAVORITES = 'favorites';
export const ALL = 'all';
/** Chips shown first, in this order; other genres present in the data follow. */
export const GENRE_ORDER = [
  'litrpg',
  'cyberpunk',
  'thriller',
  'fantasy',
  'mystery',
  'sci-fi',
  'horror',
  'core',
] as const;

export interface GenreChip {
  /** `all`, `favorites` or a genre id. */
  id: string;
  /** null for Favorites / extra chips whose count is not a facet. */
  count: number | null;
}

/** Fixed chips first (All, Favorites, known genres even at 0), then unknown genres A-Z. */
export function genreChips(
  facets: readonly CatalogFacet[],
  total: number,
  favoriteCount: number,
): GenreChip[] {
  const counts = new Map(facets.map((f) => [f.genre, f.count]));
  const known: GenreChip[] = GENRE_ORDER.map((g) => ({ id: g, count: counts.get(g) ?? 0 }));
  const extra = facets
    .filter((f) => !(GENRE_ORDER as readonly string[]).includes(f.genre))
    .sort((a, b) => a.genre.localeCompare(b.genre))
    .map((f) => ({ id: f.genre, count: f.count }));
  return [{ id: ALL, count: total }, { id: FAVORITES, count: favoriteCount }, ...known, ...extra];
}

export const CATALOG_LIMIT = 1500;

/** The catalog query for a chip and search text; `null` means "nothing to show" (no favorites). */
export function catalogQuery(
  text: string,
  chip: string,
  favorites: readonly string[],
): CatalogQuery | null {
  const q: CatalogQuery = { limit: CATALOG_LIMIT };
  const trimmed = text.trim();
  if (trimmed) q.text = trimmed;
  if (chip === FAVORITES) {
    if (favorites.length === 0) return null;
    q.ids = favorites;
  } else if (chip !== ALL) q.genre = chip;
  return q;
}

/** "mind-games" → "Mind-games": label for a genre with no translation. */
export const genreFallbackLabel = (id: string): string => id.charAt(0).toUpperCase() + id.slice(1);
