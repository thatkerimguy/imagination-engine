// In-memory Gimmick Catalog index with the exact semantics of the SQLite `gimmick_blueprints_fts`
// table (schema v3): name / tagline / genre / subgenre / tags / mood tokens, prefix + phrase
// matching (`fts-query.ts`), plus genre / engine / tier / id filters. Rebuilt only when the
// blueprint rows change, so 1,000+ blueprints answer a search in well under 10 ms.
import { ForeignKeyError } from './memory-store.ts';
import { MemorySearchIndex } from './memory-search.ts';
import type {
  CatalogFacet,
  CatalogQuery,
  DatabaseTables,
  GimmickBlueprintRow,
  GimmickPackRow,
} from './port.ts';

type CatalogTables = Pick<DatabaseTables, 'gimmickPacks' | 'gimmickBlueprints'>;

/** Upsert by id with SQLite's foreign-key rule (every blueprint's pack must exist). */
export function mergeCatalog(
  g: CatalogTables,
  packs: readonly GimmickPackRow[],
  blueprints: readonly GimmickBlueprintRow[],
): CatalogTables {
  const packIds = new Set([...g.gimmickPacks, ...packs].map((p) => p.id));
  for (const b of blueprints)
    if (!packIds.has(b.packId)) throw new ForeignKeyError(`pack of ${b.id}`);
  const merge = <R extends { id: string }>(old: readonly R[], add: readonly R[]): R[] => {
    const m = new Map(old.map((r) => [r.id, r]));
    for (const r of add) m.set(r.id, { ...r });
    return [...m.values()];
  };
  return {
    gimmickPacks: merge(g.gimmickPacks, packs),
    gimmickBlueprints: merge(g.gimmickBlueprints, blueprints),
  };
}

export interface CatalogMeta {
  name: string;
  tagline: string;
  subgenre: string;
  tags: string[];
  mood: string[];
  tier: 'free' | 'pro';
}

const strs = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Discovery fields read out of a row's `config_json` (mirrors the SQL json_extract triggers). */
export function catalogMeta(row: Pick<GimmickBlueprintRow, 'title' | 'configJson'>): CatalogMeta {
  let c: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(row.configJson);
    if (parsed && typeof parsed === 'object') c = parsed as Record<string, unknown>;
  } catch {
    // A corrupt row stays findable by its title.
  }
  return {
    name: str(c.name) || row.title,
    tagline: str(c.tagline),
    subgenre: str(c.subgenre),
    tags: strs(c.tags),
    mood: strs(c.mood),
    tier: c.tier === 'pro' ? 'pro' : 'free',
  };
}

/** Space-joined searchable text (everything but the name, which is weighted as the title). */
export const catalogText = (row: GimmickBlueprintRow, m: CatalogMeta): string =>
  [m.tagline, row.genre, m.subgenre, ...m.tags, ...m.mood].join(' ');

export class CatalogIndex {
  private source: readonly GimmickBlueprintRow[] | null = null;
  private rows = new Map<string, GimmickBlueprintRow>();
  private meta = new Map<string, CatalogMeta>();
  private byName: GimmickBlueprintRow[] = [];
  private readonly fts = new MemorySearchIndex();

  /** Re-indexes when (and only when) the row array was replaced. */
  sync(rows: readonly GimmickBlueprintRow[]): void {
    if (rows === this.source) return;
    this.source = rows;
    this.fts.clear();
    this.rows = new Map(rows.map((r) => [r.id, r]));
    this.meta = new Map();
    for (const r of rows) {
      const m = catalogMeta(r);
      this.meta.set(r.id, m);
      this.fts.put(r.id, m.name, catalogText(r, m));
    }
    this.byName = [...rows].sort(
      (a, b) => this.nameOf(a).localeCompare(this.nameOf(b)) || a.id.localeCompare(b.id),
    );
  }

  private nameOf(r: GimmickBlueprintRow): string {
    return this.meta.get(r.id)?.name ?? r.title;
  }

  search(q: CatalogQuery): GimmickBlueprintRow[] {
    const limit = q.limit ?? 200;
    const ids = q.ids ? new Set(q.ids) : null;
    const keep = (r: GimmickBlueprintRow): boolean =>
      (!q.genre || r.genre === q.genre) &&
      (!q.engine || r.engine === q.engine) &&
      (!q.tier || this.meta.get(r.id)?.tier === q.tier) &&
      (!ids || ids.has(r.id));
    const text = q.text?.trim() ?? '';
    const out: GimmickBlueprintRow[] = [];
    const pool = text
      ? this.fts.search(text, Number.MAX_SAFE_INTEGER).map((h) => this.rows.get(h.nodeId)!)
      : this.byName;
    for (const r of pool) {
      if (!keep(r)) continue;
      out.push({ ...r });
      if (out.length >= limit) break;
    }
    return out;
  }

  genreCounts(): CatalogFacet[] {
    const counts = new Map<string, number>();
    for (const r of this.rows.values()) counts.set(r.genre, (counts.get(r.genre) ?? 0) + 1);
    return [...counts]
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre));
  }
}
