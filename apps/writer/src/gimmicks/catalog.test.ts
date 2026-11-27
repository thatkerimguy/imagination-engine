import { STARTER_BLUEPRINT_LIST, starterBlueprint } from '@kn/engines/blueprints';
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../db/catalog-repo.ts';
import { createMemoryDatabase } from '../db/memory-driver.ts';
import { ALL, catalogQuery, FAVORITES, genreChips } from './catalog-model.ts';
import { seedCatalog, seedStamp, SEED_KEY, starterPacks } from './catalog-seed.ts';
import { buildCueBlock, cueFieldProps, cueSummary, isV2Cue, starterCueBlueprint } from './cue.ts';

describe('catalog seed', () => {
  it('groups the starter list into one pack per genre', () => {
    const packs = starterPacks();
    expect(packs.reduce((n, p) => n + p.blueprints.length, 0)).toBe(STARTER_BLUEPRINT_LIST.length);
    expect(packs.every((p) => p.id === `starter-${p.genre}`)).toBe(true);
  });

  it('seeds once, reseeds when the stamp changes, and is searchable', async () => {
    const db = createMemoryDatabase();
    expect(await seedCatalog(db)).toBe(true);
    expect(await seedCatalog(db)).toBe(false);
    const repo = new CatalogRepository(db);
    const all = await repo.search({ limit: 1500 });
    expect(all).toHaveLength(STARTER_BLUEPRINT_LIST.length);
    const first = STARTER_BLUEPRINT_LIST[0]!;
    const hit = await repo.search({ text: first.name.slice(0, 4) });
    expect(hit.some((e) => e.row.id === first.id)).toBe(true);
    await db.setSetting(SEED_KEY, 'stale');
    expect(await seedCatalog(db)).toBe(true);
    expect(await db.getSetting(SEED_KEY)).toBe(seedStamp());
  });

  it('keeps favorites across a reseed', async () => {
    const db = createMemoryDatabase();
    await seedCatalog(db);
    const repo = new CatalogRepository(db);
    const id = STARTER_BLUEPRINT_LIST[0]!.id;
    await repo.toggleFavorite(id);
    await db.setSetting(SEED_KEY, 'stale');
    await seedCatalog(db);
    expect(await repo.favorites()).toEqual([id]);
  });
});

describe('catalog model', () => {
  it('orders chips: All, Favorites, known genres, then extras', () => {
    const chips = genreChips(
      [
        { genre: 'zeta', count: 1 },
        { genre: 'horror', count: 3 },
      ],
      4,
      2,
    );
    expect(chips.slice(0, 4).map((c) => c.id)).toEqual([ALL, FAVORITES, 'litrpg', 'cyberpunk']);
    expect(chips.find((c) => c.id === 'horror')?.count).toBe(3);
    expect(chips.at(-1)).toEqual({ id: 'zeta', count: 1 });
  });
  it('builds queries', () => {
    expect(catalogQuery(' ', ALL, [])).toEqual({ limit: 1500 });
    expect(catalogQuery('hud', 'litrpg', [])).toMatchObject({ text: 'hud', genre: 'litrpg' });
    expect(catalogQuery('', FAVORITES, [])).toBeNull();
    expect(catalogQuery('', FAVORITES, ['a'])).toMatchObject({ ids: ['a'] });
  });
});

describe('cue helpers', () => {
  const bp = STARTER_BLUEPRINT_LIST[0]!;
  it('builds the shared v2 cue block shape', () => {
    const b = buildCueBlock(bp);
    expect(b).toMatchObject({ kind: 'module', moduleId: bp.engine, moduleVersion: bp.version });
    expect(b.props.blueprintId).toBe(bp.id);
    expect(isV2Cue(b.props)).toBe(true);
    expect(isV2Cue({ foo: 1 })).toBe(false);
    expect(cueFieldProps(b.props)).toEqual(bp.defaultProps);
    expect(starterCueBlueprint(b.props)).toBe(starterBlueprint(bp.id));
  });
  it('summarises with defaults, even for broken props', () => {
    expect(cueSummary(bp, buildCueBlock(bp).props).length).toBeGreaterThan(0);
    expect(cueSummary(bp, { blueprintId: bp.id, junk: 1 }).length).toBeGreaterThan(0);
  });
});
