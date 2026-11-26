// Story bible: `@Title` mentions and `[[Title]]` wikilinks in the chapter editor. Pure helpers (no react-native).
import type { Block } from '@kn/core';
import type { StoryKind } from '../notes/kind-meta.ts';
import { stripInlineMarkup } from './inline-markup.ts';

export interface MentionNote {
  id: string;
  title: string;
  folderPath?: string;
  kind?: StoryKind;
}

export interface ActiveMention {
  /** `@` for an `@query`, `[[` for an unfinished `[[query` wikilink. */
  trigger: '@' | '[[';
  query: string;
  start: number;
  end: number;
}

const QUERY = /^[\p{L}\p{N}_'’-]*(?: [\p{L}\p{N}_'’-]+)*$/u;

/**
 * An `@query` or unfinished `[[query` token ending at `cursor` (the nearer trigger wins). The `@`
 * must start the text or follow whitespace or an opening bracket/quote (so `a@b.com` never
 * triggers); `[[` triggers anywhere until a `]]` closes it. The query is word characters plus
 * single inner spaces, so multi-word titles can be typed; a double space ends it.
 */
export function activeMention(text: string, cursor: number): ActiveMention | null {
  const head = text.slice(0, cursor);
  const at = head.lastIndexOf('@');
  const wiki = head.lastIndexOf('[[');
  const useWiki = wiki >= 0 && wiki + 1 >= at;
  const start = useWiki ? wiki : at;
  if (start < 0) return null;
  if (!useWiki && start > 0 && !/[\s([{"'“‘—-]/.test(head[start - 1]!)) return null;
  const query = head.slice(start + (useWiki ? 2 : 1));
  if (!QUERY.test(query) || query.length > 40) return null;
  return { trigger: useWiki ? '[[' : '@', query, start, end: cursor };
}

/** Case-insensitive title match; prefix matches first, then substring, each A-Z. */
export function matchNotes<T extends MentionNote>(
  notes: readonly T[],
  query: string,
  limit = 8,
): T[] {
  const q = query.trim().toLowerCase();
  const byTitle = (a: T, b: T): number => a.title.localeCompare(b.title);
  if (!q) return [...notes].sort(byTitle).slice(0, limit);
  const prefix: T[] = [];
  const inner: T[] = [];
  for (const n of notes) {
    const t = n.title.toLowerCase();
    if (t.startsWith(q)) prefix.push(n);
    else if (t.includes(q)) inner.push(n);
  }
  return [...prefix.sort(byTitle), ...inner.sort(byTitle)].slice(0, limit);
}

const blockTexts = (blocks: readonly Block[]): string[] =>
  blocks.flatMap((b) =>
    b.kind === 'prose' || b.kind === 'dialogue' ? [stripInlineMarkup(b.text)] : [],
  );

/** Titles mentioned as `@Title` in a chapter: unique, first-seen order, longest title wins. */
export function extractMentions(blocks: readonly Block[], noteTitles: readonly string[]): string[] {
  const titles = [...new Set(noteTitles.filter((t) => t.trim()))].sort(
    (a, b) => b.length - a.length,
  );
  const found: { title: string; at: number }[] = [];
  const seen = new Set<string>();
  blockTexts(blocks).forEach((text, blockNo) => {
    const lower = text.toLowerCase();
    let i = lower.indexOf('@');
    while (i >= 0) {
      const ok = i === 0 || /[\s([{"'“‘—-]/.test(text[i - 1]!);
      const hit = ok
        ? titles.find((t) => {
            const end = i + 1 + t.length;
            return (
              lower.startsWith(t.toLowerCase(), i + 1) && !/[\p{L}\p{N}_]/u.test(text[end] ?? '')
            );
          })
        : undefined;
      if (hit && !seen.has(hit)) {
        seen.add(hit);
        found.push({ title: hit, at: blockNo * 1e6 + i });
      }
      i = lower.indexOf('@', i + 1);
    }
  });
  return found.sort((a, b) => a.at - b.at).map((f) => f.title);
}

/**
 * Replaces the active token with `[[Title]]` (wikilink trigger) or `@Title ` and returns the new
 * text and cursor. A `]]` already after the caret is reused.
 */
export function insertMention(
  text: string,
  mention: ActiveMention,
  title: string,
): { text: string; cursor: number } {
  const wiki = mention.trigger === '[[';
  const insert = wiki ? `[[${title}]]` : `@${title} `;
  const rest = text.slice(mention.end);
  const after = wiki ? rest.replace(/^\]\]/, '') : rest.replace(/^ /, '');
  return {
    text: text.slice(0, mention.start) + insert + after,
    cursor: mention.start + insert.length,
  };
}

/** Plain-text excerpt of a note (markup stripped, blocks joined by blank lines). */
export function noteExcerpt(
  noteBlocks: readonly { kind: string; text?: string }[],
  maxChars = 600,
): string {
  const text = noteBlocks
    .flatMap((b) => (b.kind !== 'scene-break' && b.text ? [stripInlineMarkup(b.text).trim()] : []))
    .filter(Boolean)
    .join('\n\n');
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > maxChars * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}
