// Pure tree, text and growth helpers over v2 node records. No storage, no platform imports.
import type { GrowthLogRecord, NodeRecord } from './types.ts';

type Sortable = Pick<NodeRecord, 'id' | 'position' | 'createdAt'>;

/** Siblings in reading order: position, then creation time, then id (stable). Pure. */
export function sortNodes<T extends Sortable>(nodes: readonly T[]): T[] {
  return [...nodes].sort(
    (a, b) =>
      a.position - b.position || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

/**
 * True when `nodeId` sits anywhere below `ancestorId` (a node is not its own descendant).
 * Cycle-safe: a corrupt loop simply ends the walk.
 */
export function isDescendant(
  parentOf: (id: string) => string | null | undefined,
  nodeId: string,
  ancestorId: string,
): boolean {
  const seen = new Set<string>([nodeId]);
  let at = parentOf(nodeId);
  while (at && !seen.has(at)) {
    if (at === ancestorId) return true;
    seen.add(at);
    at = parentOf(at);
  }
  return false;
}

/** The minimal block shape text extraction needs (prose, dialogue, scene-break, module). */
export interface TextBlockLike {
  kind: string;
  text?: string;
  speaker?: string;
  label?: string;
}

/** Fallback inline-markup stripper: `**`, `*`, `++`, `~~`, `==`, `{fg:…}` tags and `{{…}}`. */
export function stripBasicMarkup(s: string): string {
  return s
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\{\/?(?:fg|bg)(?::[^}]*)?\}/g, '')
    .replace(/\\([*_~+=\\])/g, '$1')
    .replace(/\*\*|\+\+|~~|==|\*/g, '');
}

/** Searchable plain text of a block list: one line per text block. Module blocks are skipped. */
export function extractPlainText(
  blocks: readonly TextBlockLike[],
  strip: (s: string) => string = stripBasicMarkup,
): string {
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.kind === 'prose' && b.text) lines.push(strip(b.text));
    else if (b.kind === 'dialogue' && b.text)
      lines.push(b.speaker ? `${b.speaker}: ${strip(b.text)}` : strip(b.text));
    else if (b.kind === 'scene-break' && b.label) lines.push(b.label);
  }
  return lines.join('\n');
}

/** Whitespace-separated word count of plain text. */
export const countWords = (plain: string): number => plain.split(/\s+/).filter(Boolean).length;

const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Ids of `candidates` mentioned as `@Title` in `plain` (case and accent-insensitive). The `@`
 * must start the text or follow whitespace / an opening bracket or quote, and the title must
 * end at a word boundary. Longer titles win, so `@Old Mill` never also links `@Old`. Pure.
 */
export function extractMentionTargets(
  plain: string,
  candidates: readonly Pick<NodeRecord, 'id' | 'title'>[],
): string[] {
  const text = fold(plain);
  const found = new Set<string>();
  const byLength = [...candidates]
    .filter((c) => c.title.trim())
    .sort((a, b) => b.title.length - a.title.length);
  const claimed: Array<[number, number]> = [];
  for (const c of byLength) {
    const title = fold(c.title.trim());
    let from = 0;
    for (;;) {
      const at = text.indexOf(`@${title}`, from);
      if (at < 0) break;
      from = at + 1;
      const end = at + 1 + title.length;
      const before = at === 0 ? ' ' : text[at - 1]!;
      const after = text[end] ?? ' ';
      if (!/[\s([{"'“‘—-]/u.test(before) || /[\p{L}\p{N}_]/u.test(after)) continue;
      if (claimed.some(([s, e]) => at < e && end > s)) continue;
      claimed.push([at, end]);
      found.add(c.id);
    }
  }
  return [...found];
}

type GrowthLike = Pick<GrowthLogRecord, 'nodeId' | 'dateKey' | 'wordCount' | 'isBaseline'> & {
  recordedAt: string;
};

/**
 * Words written on `dateKey` across the given logs. Per node: the day's latest count minus its
 * reference — that day's latest baseline (create / import / restore), else the latest snapshot
 * from an earlier day, else zero. Never negative per node (deleting is not writing). Pure.
 */
export function computeTodayWords(logs: readonly GrowthLike[], dateKey: string): number {
  const byNode = new Map<string, GrowthLike[]>();
  for (const l of logs) {
    if (l.dateKey > dateKey) continue;
    const list = byNode.get(l.nodeId) ?? [];
    list.push(l);
    byNode.set(l.nodeId, list);
  }
  let total = 0;
  for (const list of byNode.values()) {
    list.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    let prior: number | null = null;
    let baseline: number | null = null;
    let latest: number | null = null;
    for (const l of list) {
      if (l.dateKey < dateKey) prior = l.wordCount;
      else if (l.isBaseline) {
        baseline = l.wordCount;
        latest = l.wordCount;
      } else latest = l.wordCount;
    }
    if (latest === null) continue;
    total += Math.max(0, latest - (baseline ?? prior ?? 0));
  }
  return total;
}
