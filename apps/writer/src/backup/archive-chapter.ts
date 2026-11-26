// Single-chapter `.knchap`: the chapter row + body and its sidecar settings. Importing adds the
// chapter to a season under a fresh id (never overwrites a chapter) through `repo.saveChapter`,
// which also records the day-0 growth baseline.
import { buildArchive, parseArchive } from './archive.ts';
import { emptyTables } from '../db/port.ts';
import { newSlugId } from '../store/ids.ts';
import { toChapter } from '../store/node-mapping.ts';
import type { NovelRepository } from '../store/repository.ts';
import { fail } from './archive-format.ts';

const sidecarKeys = (id: string): string[] => [`meta/chapter-styles/${id}`, `meta/item/${id}`];

export async function packChapter(
  repo: NovelRepository,
  chapterId: string,
  now = Date.now(),
): Promise<Uint8Array> {
  const node = await repo.db.getNode(chapterId);
  if (node?.kind !== 'chapter' || node.deletedAt) throw new Error('That chapter was not found.');
  const body = await repo.db.getBody(chapterId);
  const settings = [];
  for (const key of sidecarKeys(chapterId)) {
    const valueJson = await repo.db.getSetting(key);
    if (valueJson !== null) settings.push({ key, valueJson, updatedAt: repo.nowIso() });
  }
  const tables = {
    ...emptyTables(),
    nodes: [{ ...node, coverAssetId: null }],
    nodeBodies: body ? [body] : [],
    settings,
  };
  return buildArchive('knchap', tables, {}, now, node.title);
}

export async function restoreChapter(
  repo: NovelRepository,
  bytes: Uint8Array,
  target: { novelId: string; seasonId: string },
): Promise<string> {
  const { tables } = await parseArchive(bytes, 'knchap');
  const node = tables.nodes[0];
  if (tables.nodes.length !== 1 || node?.kind !== 'chapter')
    return fail('A .knchap must contain one chapter.');
  const id = newSlugId();
  const chapter = toChapter(node, tables.nodeBodies[0] ?? null);
  await repo.saveChapter(target.novelId, { ...chapter, id, seasonId: target.seasonId });
  const [from, to] = [sidecarKeys(node.id), sidecarKeys(id)];
  for (const [i, key] of from.entries()) {
    const row = tables.settings.find((s) => s.key === key);
    if (row) await repo.db.setSetting(to[i]!, row.valueJson);
  }
  repo.notifyChanged();
  return id;
}
