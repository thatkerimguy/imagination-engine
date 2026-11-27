// CatalogRepository: the writer's one API over the Gimmick Catalog (schema v3). Search, genre
// facets, Favorites and Recent sit on top of DatabasePort, so the native FTS5 table and the
// in-memory index answer identically. Favorites / Recent live in `settings` (catalog/favorites,
// catalog/recent), so reinstalling or updating a pack never loses them.
import type { GimmickBlueprint } from '@kn/core/gimmicks';
import type {
  CatalogFacet,
  CatalogQuery,
  DatabasePort,
  GimmickBlueprintRow,
  GimmickPackRow,
} from './port.ts';

export const FAVORITES_KEY = 'catalog/favorites';
export const RECENT_KEY = 'catalog/recent';
export const RECENT_MAX = 12;

export interface CatalogEntry {
  row: GimmickBlueprintRow;
  /** The full blueprint parsed from `config_json` (null when the row is corrupt). */
  blueprint: GimmickBlueprint | null;
}

export interface CatalogPack {
  id: string;
  genre: string;
  title: string;
  version: number;
  blueprints: readonly GimmickBlueprint[];
}

function parseBlueprint(row: GimmickBlueprintRow): GimmickBlueprint | null {
  try {
    const b: unknown = JSON.parse(row.configJson);
    return b && typeof b === 'object' && (b as { id?: unknown }).id === row.id
      ? (b as GimmickBlueprint)
      : null;
  } catch {
    return null;
  }
}

export const blueprintRow = (
  b: GimmickBlueprint,
  packId: string,
  createdAt: string,
): GimmickBlueprintRow => ({
  id: b.id,
  packId,
  engine: b.engine,
  genre: b.genre,
  title: b.name,
  configJson: JSON.stringify(b),
  createdAt,
});

export class CatalogRepository {
  constructor(private readonly db: DatabasePort) {}

  /** Installs (or updates) packs and their blueprints in one write. */
  async install(packs: readonly CatalogPack[], now = new Date().toISOString()): Promise<void> {
    const packRows: GimmickPackRow[] = packs.map((p) => ({
      id: p.id,
      genre: p.genre,
      title: p.title,
      version: p.version,
      metaJson: null,
      createdAt: now,
    }));
    const rows = packs.flatMap((p) => p.blueprints.map((b) => blueprintRow(b, p.id, now)));
    await this.db.putGimmicks(packRows, rows);
  }

  async search(query: CatalogQuery = {}): Promise<CatalogEntry[]> {
    const rows = await this.db.searchGimmicks(query);
    return rows.map((row) => ({ row, blueprint: parseBlueprint(row) }));
  }

  async get(id: string): Promise<GimmickBlueprint | null> {
    const [row] = await this.db.searchGimmicks({ ids: [id], limit: 1 });
    return row ? parseBlueprint(row) : null;
  }

  /** Every listed id that exists, as blueprints, in the order given. */
  async getMany(ids: readonly string[]): Promise<GimmickBlueprint[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.searchGimmicks({ ids, limit: ids.length });
    const byId = new Map(rows.map((r) => [r.id, parseBlueprint(r)]));
    return ids.flatMap((id) => {
      const b = byId.get(id);
      return b ? [b] : [];
    });
  }

  genreCounts(): Promise<CatalogFacet[]> {
    return this.db.gimmickGenreCounts();
  }

  private async ids(key: string): Promise<string[]> {
    const raw = await this.db.getSetting(key);
    if (!raw) return [];
    try {
      const v: unknown = JSON.parse(raw);
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  favorites(): Promise<string[]> {
    return this.ids(FAVORITES_KEY);
  }

  /** Toggles a favourite; returns the new state. */
  async toggleFavorite(id: string): Promise<boolean> {
    const favs = await this.favorites();
    const on = !favs.includes(id);
    const next = on ? [id, ...favs] : favs.filter((f) => f !== id);
    await this.db.setSetting(FAVORITES_KEY, JSON.stringify(next));
    return on;
  }

  /** Most recent first. */
  recent(): Promise<string[]> {
    return this.ids(RECENT_KEY);
  }

  async pushRecent(id: string): Promise<void> {
    const next = [id, ...(await this.recent()).filter((r) => r !== id)].slice(0, RECENT_MAX);
    await this.db.setSetting(RECENT_KEY, JSON.stringify(next));
  }
}
