// Shared write helpers for the node repository: sibling positions, @mention links, and the
// chapter write (row + body + links) with its day-0 growth baseline for brand-new chapters.
import {
  extractMentionTargets,
  type ChapterDocument,
  type NodeLinkRecord,
  type NodeRecord,
} from '@kn/core';
import type { DatabasePort, NodeWrite } from '../db/port.ts';
import { countsOf } from './growth-logger.ts';
import { recordBaseline } from './growth-store.ts';
import { chapterNode } from './node-mapping.ts';
import type { NovelRepository } from './repository.ts';

/** Story-bible kinds an `@Title` mention can point at. */
export const MENTION_KINDS = ['note', 'character', 'location', 'lore'] as const;

/** One past the highest sibling position (trashed siblings included, so restores never clash). */
export async function nextPosition(db: DatabasePort, parentId: string | null): Promise<number> {
  const siblings = await db.listNodes({ parentId, includeDeleted: true });
  return siblings.reduce((max, n) => Math.max(max, n.position + 1), 0);
}

/** Outgoing `mention` links for `@Title` references in `plain` to active story-bible nodes. */
export async function mentionLinks(
  db: DatabasePort,
  sourceId: string,
  plain: string,
  now: string,
  extra: readonly Pick<NodeRecord, 'id' | 'title'>[] = [],
): Promise<NodeLinkRecord[]> {
  if (!plain.includes('@')) return [];
  const candidates = [...(await db.listNodes({ kinds: MENTION_KINDS })), ...extra].filter(
    (n) => n.id !== sourceId,
  );
  return extractMentionTargets(plain, candidates).map((targetId) => ({
    sourceId,
    targetId,
    relation: 'mention',
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
): Promise<PendingWrite> {
  const existing = await repo.db.getNode(chapter.id);
  if (existing && existing.kind !== 'chapter')
    throw new Error(`Node ${chapter.id} is a ${existing.kind}, not a chapter`);
  const sameParent = existing?.parentId === chapter.seasonId;
  const position = sameParent ? existing.position : await nextPosition(repo.db, chapter.seasonId);
  const now = repo.nowIso();
  const { node, body } = chapterNode(chapter, novelId, existing, position, now);
  const links = await mentionLinks(repo.db, node.id, body.plainText, now);
  return {
    entry: { node, body, links },
    afterCommit: async () => {
      if (!existing) await recordBaseline(repo, [{ nodeId: node.id, counts: countsOf(chapter) }]);
    },
  };
}
