// Seeds the starter blueprints into the SQLite / in-memory catalog: one pack per genre
// (`starter-<genre>`, version SEED_VERSION). Runs once per database and again whenever the seed
// version or the number of starter blueprints changes. Favorites / Recent live in settings, so
// reseeding never loses them.
import { STARTER_BLUEPRINT_LIST } from '@kn/engines/blueprints';
import type { GimmickBlueprint } from '@kn/core/gimmicks';
import { CatalogRepository, type CatalogPack } from '../db/catalog-repo.ts';
import type { DatabasePort } from '../db/port.ts';

/** Bump when the starter data changes in a way the blueprint count does not reveal. */
export const SEED_VERSION = 1;
export const SEED_KEY = 'catalog/seed';

export const seedStamp = (
  blueprints: readonly GimmickBlueprint[] = STARTER_BLUEPRINT_LIST,
): string => `${SEED_VERSION}:${blueprints.length}`;

/** One pack per genre, in first-seen order. */
export function starterPacks(
  blueprints: readonly GimmickBlueprint[] = STARTER_BLUEPRINT_LIST,
): CatalogPack[] {
  const byGenre = new Map<string, GimmickBlueprint[]>();
  for (const b of blueprints) byGenre.set(b.genre, [...(byGenre.get(b.genre) ?? []), b]);
  return [...byGenre].map(([genre, list]) => ({
    id: `starter-${genre}`,
    genre,
    title: genre,
    version: SEED_VERSION,
    blueprints: list,
  }));
}

/** Installs the starter packs when the stored stamp differs. Returns true when it wrote. */
export async function seedCatalog(
  db: DatabasePort,
  blueprints: readonly GimmickBlueprint[] = STARTER_BLUEPRINT_LIST,
): Promise<boolean> {
  const stamp = seedStamp(blueprints);
  if ((await db.getSetting(SEED_KEY)) === stamp) return false;
  await new CatalogRepository(db).install(starterPacks(blueprints));
  await db.setSetting(SEED_KEY, stamp);
  return true;
}

const pending = new WeakMap<DatabasePort, Promise<void>>();

/** Memoised per database, so every screen can await it cheaply. */
export function ensureCatalogSeeded(db: DatabasePort): Promise<void> {
  let p = pending.get(db);
  if (!p) {
    p = seedCatalog(db).then(
      () => undefined,
      (err: unknown) => {
        pending.delete(db);
        throw err;
      },
    );
    pending.set(db, p);
  }
  return p;
}
