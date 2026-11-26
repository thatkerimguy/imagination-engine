// Shared write helpers for the node repository: sibling positions, @mention links, and the
// chapter write (row + body + links) with its day-0 growth baseline for brand-new chapters.
import {
  extractAllNodeLinks,
  type Block,
  type ChapterDocument,
  type NodeLinkRecord,
  type NodeRecord,
} from '@kn/core';
import type { DatabasePort, NodeWrite } from '../db/port.ts';
import { countsOf } from './growth-logger.ts';
import { recordBaseline } from './growth-store.ts';
import { chapterNode, plainTextOf } from './node-mapping.ts';
import type { NovelRepository } from './repository.ts';

/** Story-bible kinds an `@Title` mention can point at. */
export const MENTION_KINDS = ['note', 'character', 'location', 'lore'] as const;
/** Everything an `@Title` or `[[Title]]` link resolves against (chapters too). */
export const LINK_TARGET_KINDS = [...MENTION_KINDS, 'chapter'] as const;

/** One past the highest sibling position (trashed siblings included, so restores never clash). */
export async function nextPosition(db: DatabasePort, parentId: string | null): Promise<number> {
  const siblings = await db.listNodes({ parentId, includeDeleted: true });
  return siblings.reduce((max, n) => Math.max(max, n.position + 1), 0);
}

/**
 * Outgoing links in `plain`: `[[Title]]` / `[[Title|Alias]]` (`reference`) and `@Title`
 * (`mention`) to active story-bible nodes and chapters. Trashed nodes never resolve.
 */
export async function mentionLinks(
  db: DatabasePort,
  sourceId: string,
  plain: string,
  now: string,
  extra: readonly Pick<NodeRecord, 'id' | 'title'>[] = [],
): Promise<NodeLinkRecord[]> {
  if (!plain.includes('@') && !plain.includes('[[')) return [];
  const candidates = [...(await db.listNodes({ kinds: LINK_TARGET_KINDS })), ...extra].filter(
    (n) => n.id !== sourceId,
  );
  return extractAllNodeLinks(plain, candidates).map(({ targetId, relation }) => ({
    sourceId,
    targetId,
    relation,
    createdAt: now,
  }));
}

export interface PendingWrite {
  entry: NodeWrite;
  /** Runs once the write committed (growth baseline for new chapters). */
  afterCommit(): Promise<void>;
}

export async function chapterWrite(
  repo: NovelRepository,
  novelId: string,
  chapter: ChapterDocument,
  /** Writer source blocks to read links from (stored text has wikilinks rendered away). */
  linkBlocks?: readonly Block[],
): Promise<PendingWrite> {
  const existing = await repo.db.getNode(chapter.id);
  if (existing && existing.kind !== 'chapter')
    throw new Error(`Node ${chapter.id} is a ${existing.kind}, not a chapter`);
  const sameParent = existing?.parentId === chapter.seasonId;
  const position = sameParent ? existing.position : await nextPosition(repo.db, chapter.seasonId);
  const now = repo.nowIso();
  const { node, body } = chapterNode(chapter, novelId, existing, position, now);
  const links = await mentionLinks(
    repo.db,
    node.id,
    linkBlocks ? plainTextOf(linkBlocks) : body.plainText,
    now,
  );
  return {
    entry: { node, body, links },
    afterCommit: async () => {
      if (!existing) await recordBaseline(repo, [{ nodeId: node.id, counts: countsOf(chapter) }]);
    },
  };
}
