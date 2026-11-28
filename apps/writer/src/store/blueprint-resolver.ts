// Blueprint lookup for prepareChapter: SQLite catalog (installed packs) first, bundled starters
// as the fallback. prepareChapter stays synchronous and pure; this resolves the cue ids up front.
import type { Block, ChapterDocument } from '@kn/core';
import type { GimmickBlueprint } from '@kn/core/gimmicks';
import { starterBlueprint } from '@kn/engines/blueprints';
import { CatalogRepository } from '../db/catalog-repo.ts';
import type { DatabasePort } from '../db/port.ts';

export type BlueprintResolver = (id: string) => GimmickBlueprint | undefined;

/** Default resolver: the bundled starters only. */
export const starterResolver: BlueprintResolver = (id) => starterBlueprint(id) ?? undefined;

export const cueBlueprintIds = (blocks: readonly Block[]): string[] => [
  ...new Set(
    blocks.flatMap((b) =>
      b.kind === 'module' && typeof b.props.blueprintId === 'string' ? [b.props.blueprintId] : [],
    ),
  ),
];

/** Pre-loads every cue blueprint of `chapters` from the catalog; unknown ids fall back to starters. */
export async function catalogResolver(
  db: DatabasePort,
  chapters: readonly Pick<ChapterDocument, 'blocks'>[],
): Promise<BlueprintResolver> {
  const ids = cueBlueprintIds(chapters.flatMap((c) => c.blocks));
  let found: GimmickBlueprint[] = [];
  try {
    found = await new CatalogRepository(db).getMany(ids);
  } catch {
    // Catalog not installed yet (older schema): starters still resolve below.
  }
  const byId = new Map(found.map((b) => [b.id, b]));
  return (id) => byId.get(id) ?? starterBlueprint(id) ?? undefined;
}
