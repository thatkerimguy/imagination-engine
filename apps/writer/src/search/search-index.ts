// Pure full-text search over the Author's whole workspace (novels, chapters, notes, folders).
// No React / React Native / storage imports: it is built from plain `SearchSources`, kept in
// memory, and queried synchronously. Locked items index ONLY their title, never body text.
import type { Block } from '@kn/core';
import { stripInlineMarkup } from '../editor/inline-markup.ts';
import type { ItemMeta } from '../store/item-meta.ts';

export interface SearchSources {
  novels: { id: string; title: string; subtitle?: string }[];
  chapters: {
    novelId: string;
    novelTitle: string;
    seasonId: string;
    chapterId: string;
    title: string;
    blocks: readonly Block[];
  }[];
  folders: { id: string; title: string; parentFolderId: string | null }[];
  docs: { id: string; title: string; folderId: string | null; blocks: readonly Block[] }[];
  meta: ReadonlyMap<string, ItemMeta>;
}

export type SearchScope = 'all' | 'chapters' | 'notes';
export type SearchKind = 'novel' | 'chapter' | 'folder' | 'doc';
export type SearchTarget =
  | { novelId: string; seasonId: string; chapterId: string; blockId?: string }
  | { docId: string; folderId: string | null }
  | { folderId: string }
  | { novelId: string };

export interface SearchResult {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  /** ~100 chars of plain text around the first hit ('' for title-only hits). */
  excerpt: string;
  /** `[start, end)` offsets into `excerpt`. */
  highlights: Array<[number, number]>;
  /** `[start, end)` offsets into `title`. */
  titleHighlights: Array<[number, number]>;
  locked: boolean;
  target: SearchTarget;
}

interface Entry {
  kind: SearchKind;
  scope: 'chapters' | 'notes';
  id: string;
  title: string;
  subtitle: string;
  /** Searched text: the title, or one block's plain text. */
  text: string;
  norm: string;
  isTitle: boolean;
  locked: boolean;
  target: SearchTarget;
}

export interface SearchIndex {
  entries: readonly Entry[];
}

const foldUnit = (c: string): string => {
  const n = c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return n.length === 1 ? n : c;
};

/** Lower-cases and strips diacritics one UTF-16 unit at a time, so offsets never shift. */
export function normalizeText(s: string): string {
  return s.replace(/[^ -~\t\n\r]/g, foldUnit).toLowerCase();
}

// Plain text of one block: prose, `speaker: line`, or the scene-break label.
export function blockText(b: Block): string {
  if (b.kind === 'prose') return stripInlineMarkup(b.text);
  if (b.kind === 'dialogue') {
    const line = stripInlineMarkup(b.text);
    return b.speaker ? `${b.speaker}: ${line}` : line;
  }
  if (b.kind === 'scene-break') return [b.label, b.timestamp].filter(Boolean).join(' · ');
  return '';
}

const flat = (s: string): string => s.replace(/\s/g, ' ');

export interface BuildOptions {
  /** Whether an item id is locked (default: `meta.locked`). Locked → title only. */
  isLocked?(id: string): boolean;
}

function folderPath(
  id: string | null,
  byId: ReadonlyMap<string, SearchSources['folders'][number]>,
): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (let cur = id; cur && !seen.has(cur);) {
    seen.add(cur);
    const f = byId.get(cur);
    if (!f) break;
    parts.unshift(f.title);
    cur = f.parentFolderId;
  }
  return ['Notes', ...parts].join(' / ');
}

export function buildSearchIndex(src: SearchSources, opts: BuildOptions = {}): SearchIndex {
  const locked = opts.isLocked ?? ((id: string) => src.meta.get(id)?.locked === true);
  const entries: Entry[] = [];
  const add = (e: Omit<Entry, 'norm' | 'text'> & { text: string }): void => {
    const text = flat(e.text);
    if (text.trim()) entries.push({ ...e, text, norm: normalizeText(text) });
  };
  for (const n of src.novels) {
    const lock = locked(n.id);
    const target = { novelId: n.id };
    const base = { kind: 'novel', scope: 'chapters', id: n.id, locked: lock, target } as const;
    add({ ...base, title: n.title, subtitle: 'Book', text: n.title, isTitle: true });
    if (n.subtitle && !lock)
      add({ ...base, title: n.title, subtitle: 'Book', text: n.subtitle, isTitle: false });
  }
  for (const c of src.chapters) {
    const lock = locked(c.chapterId) || locked(c.novelId);
    const target = { novelId: c.novelId, seasonId: c.seasonId, chapterId: c.chapterId };
    const base = { kind: 'chapter', scope: 'chapters', id: c.chapterId, locked: lock } as const;
    const head = { ...base, title: c.title, subtitle: c.novelTitle };
    add({ ...head, text: c.title, isTitle: true, target });
    if (!lock)
      for (const b of c.blocks)
        add({ ...head, text: blockText(b), isTitle: false, target: { ...target, blockId: b.id } });
  }
  const byId = new Map(src.folders.map((f) => [f.id, f]));
  for (const f of src.folders)
    add({
      kind: 'folder',
      scope: 'notes',
      id: f.id,
      title: f.title,
      subtitle: folderPath(f.parentFolderId, byId),
      text: f.title,
      isTitle: true,
      locked: locked(f.id),
      target: { folderId: f.id },
    });
  for (const d of src.docs) {
    const lock = locked(d.id);
    const base = {
      kind: 'doc',
      scope: 'notes',
      id: d.id,
      title: d.title,
      subtitle: folderPath(d.folderId, byId),
      locked: lock,
      target: { docId: d.id, folderId: d.folderId },
    } as const;
    add({ ...base, text: d.title, isTitle: true });
    if (!lock) for (const b of d.blocks) add({ ...base, text: blockText(b), isTitle: false });
  }
  return { entries };
}

const WINDOW = 100;
const LEAD = 36;

function occurrences(norm: string, terms: readonly string[]): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  for (const t of terms)
    for (let i = norm.indexOf(t); i >= 0; i = norm.indexOf(t, i + 1)) spans.push([i, i + t.length]);
  spans.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: Array<[number, number]> = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([s[0], s[1]]);
  }
  return merged;
}

function excerptOf(e: Entry, spans: Array<[number, number]>) {
  const first = spans[0]?.[0] ?? 0;
  const end = Math.min(e.text.length, Math.max(0, first - LEAD) + WINDOW);
  const start = Math.max(0, Math.min(first - LEAD, end - WINDOW));
  const pre = start > 0 ? '…' : '';
  const post = end < e.text.length ? '…' : '';
  const shift = pre.length - start;
  const highlights: Array<[number, number]> = [];
  for (const [a, b] of spans)
    if (b > start && a < end)
      highlights.push([Math.max(a, start) + shift, Math.min(b, end) + shift]);
  return { excerpt: pre + e.text.slice(start, end).trim() + post, highlights };
}

function score(e: Entry, terms: readonly string[], spans: Array<[number, number]>): number {
  let s = e.isTitle ? 100 : 0;
  if (e.kind === 'novel' || e.kind === 'folder') s += 5;
  const at = spans[0]?.[0] ?? 0;
  if (e.norm.startsWith(terms[0] ?? '')) s += 20;
  else if (/[^\p{L}\p{N}]/u.test(e.norm[at - 1] ?? ' ')) s += 8;
  if (e.isTitle && e.norm === terms.join(' ')) s += 30;
  return s - Math.min(at, 2000) / 100;
}

export interface SearchOptions {
  scope?: SearchScope;
  limit?: number;
}
const PER_ITEM = 4;

/** Ranked results; every whitespace-separated term must appear (AND) in a title or one block. */
export function search(
  index: SearchIndex,
  query: string,
  opts: SearchOptions = {},
): SearchResult[] {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const scope = opts.scope ?? 'all';
  const hits: Array<{ e: Entry; score: number; order: number; spans: Array<[number, number]> }> =
    [];
  index.entries.forEach((e, order) => {
    if (scope !== 'all' && e.scope !== scope) return;
    if (!terms.every((t) => e.norm.includes(t))) return;
    const spans = occurrences(e.norm, terms);
    hits.push({ e, score: score(e, terms, spans), order, spans });
  });
  hits.sort((a, b) => b.score - a.score || a.order - b.order);
  const perItem = new Map<string, number>();
  const out: SearchResult[] = [];
  for (const h of hits) {
    if (out.length >= (opts.limit ?? 50)) break;
    const e = h.e;
    const key = `${e.kind}:${e.id}`;
    const n = perItem.get(key) ?? 0;
    if (n >= PER_ITEM) continue;
    perItem.set(key, n + 1);
    const x = e.isTitle ? { excerpt: '', highlights: [] } : excerptOf(e, h.spans);
    out.push({
      kind: e.kind,
      id: e.id,
      title: e.title,
      subtitle: e.subtitle,
      ...x,
      titleHighlights: e.isTitle ? h.spans : [],
      locked: e.locked,
      target: e.target,
    });
  }
  return out;
}
