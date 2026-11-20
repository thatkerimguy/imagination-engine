// Writer-only per-block styling sidecar for a chapter (`meta/chapter-styles/<chapterId>`).
// The canonical chapter record stays @kn/core-valid and holds only reader-safe text; this sidecar
// keeps block layout (alignment, headings, quote…) and, in `raw`, the Author's full source text
// when it contains writer-only spans ({fg}, {bg}, {{comment}}) that the chapter record drops.
import type { Block, ChapterDocument } from '@kn/core';
import { sanitizeForReader } from '../editor/inline-markup.ts';
import type { NovelRepository } from './repository.ts';

export interface BlockStyle {
  align?: 'left' | 'center' | 'right';
  indent?: boolean;
  heading?: 1 | 2 | 3;
  quote?: boolean;
  list?: 'bullet';
  fgColor?: string;
  bgColor?: string;
  /** Writer source text; present only when it differs from the stored (sanitized) text. */
  raw?: string;
}

export type ChapterStyles = Readonly<Record<string, BlockStyle>>;

export const chapterStylesKey = (chapterId: string): string => `meta/chapter-styles/${chapterId}`;

const HEX = /^#[0-9a-fA-F]{6}$/;

function cleanStyle(v: unknown): BlockStyle {
  const s = (v ?? {}) as Record<string, unknown>;
  const out: BlockStyle = {};
  if (s.align === 'left' || s.align === 'center' || s.align === 'right') out.align = s.align;
  if (s.indent === true) out.indent = true;
  if (s.heading === 1 || s.heading === 2 || s.heading === 3) out.heading = s.heading;
  if (s.quote === true) out.quote = true;
  if (s.list === 'bullet') out.list = 'bullet';
  if (typeof s.fgColor === 'string' && HEX.test(s.fgColor)) out.fgColor = s.fgColor;
  if (typeof s.bgColor === 'string' && HEX.test(s.bgColor)) out.bgColor = s.bgColor;
  if (typeof s.raw === 'string') out.raw = s.raw;
  return out;
}

const isEmpty = (s: BlockStyle): boolean => Object.keys(s).length === 0;

export async function loadChapterStyles(
  repo: NovelRepository,
  chapterId: string,
): Promise<ChapterStyles> {
  const stored = await repo.docs.read<Record<string, unknown>>(chapterStylesKey(chapterId));
  const out: Record<string, BlockStyle> = {};
  for (const [id, v] of Object.entries(stored?.data ?? {})) {
    const s = cleanStyle(v);
    if (!isEmpty(s)) out[id] = s;
  }
  return out;
}

export async function saveChapterStyles(
  repo: NovelRepository,
  chapterId: string,
  styles: ChapterStyles,
): Promise<void> {
  if (Object.keys(styles).length === 0) await repo.docs.remove(chapterStylesKey(chapterId));
  else await repo.docs.write(chapterStylesKey(chapterId), styles);
}

/** Merges `patch` into one block's style; `undefined` values clear a field. Pure. */
export function setBlockStyle(
  styles: ChapterStyles,
  blockId: string,
  patch: Partial<Record<keyof BlockStyle, BlockStyle[keyof BlockStyle] | undefined>>,
): ChapterStyles {
  const merged = Object.fromEntries(
    Object.entries({ ...styles[blockId], ...patch }).filter(
      ([, v]) => v !== undefined && v !== false,
    ),
  );
  const next = cleanStyle(merged);
  const rest = Object.fromEntries(Object.entries(styles).filter(([id]) => id !== blockId));
  return isEmpty(next) ? rest : { ...rest, [blockId]: next };
}

/** Drops entries for blocks that no longer exist. Returns the same object when nothing changed. */
export function pruneStyles(styles: ChapterStyles, blockIds: readonly string[]): ChapterStyles {
  const keep = new Set(blockIds);
  const ids = Object.keys(styles);
  if (ids.every((id) => keep.has(id))) return styles;
  return Object.fromEntries(Object.entries(styles).filter(([id]) => keep.has(id)));
}

const textOf = (b: Block): string | undefined =>
  b.kind === 'prose' || b.kind === 'dialogue' ? b.text : undefined;

/**
 * Records writer source text for every block whose text carries writer-only markup, and clears
 * `raw` elsewhere. Call with the editor draft before saving the sidecar.
 */
export function captureRawText(chapter: ChapterDocument, styles: ChapterStyles): ChapterStyles {
  let next = pruneStyles(
    styles,
    chapter.blocks.map((b) => b.id),
  );
  for (const b of chapter.blocks) {
    const text = textOf(b);
    const raw = text !== undefined && sanitizeForReader(text) !== text ? text : undefined;
    if (next[b.id]?.raw !== raw) next = setBlockStyle(next, b.id, { raw });
  }
  return next;
}

/**
 * Restores writer source text onto a loaded chapter. A `raw` is applied only if it still
 * sanitizes to the stored text, so edits made elsewhere (e.g. an imported bundle) always win.
 */
export function applyRawText(chapter: ChapterDocument, styles: ChapterStyles): ChapterDocument {
  let changed = false;
  const blocks = chapter.blocks.map((b): Block => {
    const raw = styles[b.id]?.raw;
    const text = textOf(b);
    if (raw === undefined || text === undefined || sanitizeForReader(raw) !== text) return b;
    changed = true;
    return { ...b, text: raw } as Block;
  });
  return changed ? { ...chapter, blocks } : chapter;
}
