// Additive v2 link extraction: `[[Title]]` / `[[Title|Alias]]` wikilinks alongside `@Title`
// mentions. Pure; the writer turns the result into `node_links` rows.
import { extractMentionTargets } from './tree.ts';
import type { LinkRelation, NodeRecord } from './types.ts';

type Candidate = Pick<NodeRecord, 'id' | 'title'>;

/** One `[[…]]` occurrence: the target title, the optional display alias, and its source span. */
export interface WikilinkMatch {
  title: string;
  alias: string | null;
  start: number;
  end: number;
}

const WIKILINK = /\[\[([^[\]|\n]+?)(?:\|([^[\]\n]*))?\]\]/g;

/** Every well-formed `[[Title]]` / `[[Title|Alias]]` in `text`, in order. Pure. */
export function findWikilinks(text: string): WikilinkMatch[] {
  const out: WikilinkMatch[] = [];
  for (const m of text.matchAll(WIKILINK)) {
    const title = m[1]!.trim();
    if (!title) continue;
    const alias = m[2]?.trim() || null;
    out.push({ title, alias, start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/** Reader-facing text of wikilinks: `[[Title|Alias]]` → `Alias`, `[[Title]]` → `Title`. Pure. */
export function renderWikilinks(text: string): string {
  if (!text.includes('[[')) return text;
  return text.replace(WIKILINK, (whole, title: string, alias?: string) => {
    const shown = alias?.trim() || title.trim();
    return shown || whole;
  });
}

const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Ids of `candidates` targeted by `[[Title]]` links (case and accent-insensitive exact title). */
export function extractWikilinkTargets(text: string, candidates: readonly Candidate[]): string[] {
  const links = findWikilinks(text);
  if (!links.length) return [];
  const byTitle = new Map<string, string>();
  for (const c of candidates) {
    const key = fold(c.title);
    if (key && !byTitle.has(key)) byTitle.set(key, c.id);
  }
  const found = new Set<string>();
  for (const l of links) {
    const id = byTitle.get(fold(l.title));
    if (id) found.add(id);
  }
  return [...found];
}

export interface ExtractedLink {
  targetId: string;
  relation: LinkRelation;
}

/**
 * Every outgoing link in `text`: `[[Title]]` wikilinks (`reference`) first, then `@Title`
 * mentions (`mention`, longest title wins, emails ignored). One entry per target. Pure.
 */
export function extractAllNodeLinks(
  text: string,
  candidates: readonly Candidate[],
): ExtractedLink[] {
  const seen = new Set<string>();
  const out: ExtractedLink[] = [];
  const add = (targetId: string, relation: LinkRelation): void => {
    if (seen.has(targetId)) return;
    seen.add(targetId);
    out.push({ targetId, relation });
  };
  for (const id of extractWikilinkTargets(text, candidates)) add(id, 'reference');
  // Wikilink bodies are blanked first so `[[@Old Mill]]` is never also read as a mention.
  const rest = text.includes('[[') ? text.replace(WIKILINK, (m) => ' '.repeat(m.length)) : text;
  if (rest.includes('@'))
    for (const id of extractMentionTargets(rest, candidates)) add(id, 'mention');
  return out;
}
