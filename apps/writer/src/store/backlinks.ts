// Backlinks: every active node that links to a story-bible node through `[[Title]]`,
// `[[Title|alias]]` or `@Title` (rows of `node_links`, written on each chapter / note save).
import type { NodeKind } from '@kn/core';
import type { NovelRepository } from './repository.ts';
import { hiddenNodeIds } from './trash-model.ts';

export interface Backlink {
  sourceId: string;
  sourceKind: NodeKind;
  sourceTitle: string;
  /** Chapters: the book the chapter belongs to. */
  parentBookTitle?: string;
  bookId?: string;
  seasonId?: string;
  /** About 90 characters of the source around the first mention of the target. */
  excerpt: string;
}

const EXCERPT_CHARS = 90;

/** ~90 characters of `plain` around the first occurrence of `title`, ellipsized. Pure. */
export function excerptAround(plain: string, title: string): string {
  const text = plain.replace(/\s+/g, ' ').trim();
  if (text.length <= EXCERPT_CHARS) return text;
  const hit = title.trim() ? text.toLowerCase().indexOf(title.trim().toLowerCase()) : -1;
  const start = hit < 0 ? 0 : Math.max(0, hit - Math.floor((EXCERPT_CHARS - title.length) / 2));
  const end = Math.min(text.length, start + EXCERPT_CHARS);
  const from = Math.max(0, Math.min(start, end - EXCERPT_CHARS));
  return `${from > 0 ? '…' : ''}${text.slice(from, end).trim()}${end < text.length ? '…' : ''}`;
}

/** Live backlinks of `targetNodeId`: no trashed sources, no self-links, sorted by title. */
export async function listBacklinks(
  repo: NovelRepository,
  targetNodeId: string,
): Promise<Backlink[]> {
  const links = (await repo.db.listLinks({ targetId: targetNodeId })).filter(
    (l) => l.sourceId !== targetNodeId,
  );
  if (links.length === 0) return [];
  const [nodes, target] = await Promise.all([
    repo.db.listNodes({ includeDeleted: true }),
    repo.db.getNode(targetNodeId),
  ]);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const hidden = hiddenNodeIds(nodes);
  const out: Backlink[] = [];
  for (const id of new Set(links.map((l) => l.sourceId))) {
    const n = byId.get(id);
    if (!n || hidden.has(id)) continue;
    const body = await repo.db.getBody(id);
    const book = n.bookId ? byId.get(n.bookId) : undefined;
    out.push({
      sourceId: id,
      sourceKind: n.kind,
      sourceTitle: n.title,
      ...(book ? { parentBookTitle: book.title } : {}),
      ...(n.bookId ? { bookId: n.bookId } : {}),
      ...(n.kind === 'chapter' && n.parentId ? { seasonId: n.parentId } : {}),
      excerpt: excerptAround(body?.plainText ?? '', target?.title ?? ''),
    });
  }
  return out.sort((a, b) => a.sourceTitle.localeCompare(b.sourceTitle));
}
