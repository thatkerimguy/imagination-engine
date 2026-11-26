// "Chrome Tide": the Phase 1 vertical slice, seeded straight into the v2 relational schema as an
// `interactive` (kinetic fiction) book so the Author can edit and preview at once.
import type { ChapterDocument, NovelManifest, SeasonManifest } from '@kn/core';
import chapter from '../../../../sample-novels/vertical-slice/seasons/s01/ch01.json';
import season from '../../../../sample-novels/vertical-slice/seasons/s01/season.json';
import novel from '../../../../sample-novels/vertical-slice/novel.json';
import type { NovelBundle, NovelRepository } from './repository.ts';

export const DEMO_NOVEL_ID = 'vertical-slice';
const SEEDED = 'setting/seeded-demo';

/** Fresh deep copy each time, so edits never mutate the bundled JSON. Validated on import. */
export function demoBundle(): NovelBundle {
  const copy = <T>(v: unknown): T => JSON.parse(JSON.stringify(v)) as T;
  return {
    novel: copy<NovelManifest>(novel),
    seasons: [{ season: copy<SeasonManifest>(season), chapters: [copy<ChapterDocument>(chapter)] }],
    workspaceMode: 'interactive',
  };
}

/** Restores the demo book to its shipped state (replacing any edits to it). */
export async function loadDemoNovel(repo: NovelRepository): Promise<void> {
  await repo.deleteNovel(DEMO_NOVEL_ID);
  await repo.importBundle(demoBundle());
}

/** First launch only: an empty shelf gets the demo. Deleting it later does not bring it back. */
export async function seedOnFirstLaunch(repo: NovelRepository): Promise<boolean> {
  if (await repo.docs.read<boolean>(SEEDED)) return false;
  const books = await repo.db.listNodes({ kinds: ['book'], includeDeleted: true });
  const empty = books.length === 0;
  if (empty) await repo.importBundle(demoBundle());
  await repo.docs.write(SEEDED, true);
  return empty;
}
