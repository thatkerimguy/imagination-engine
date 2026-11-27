// 9:16 teaser card model (pure): pull-quote extraction, presets and the shared font-size layout
// that the native view and the web canvas both use so they render identically.
import type { Block } from '@kn/core';
import { stripInlineMarkup } from '../editor/inline-markup.ts';
import { getWriterModule } from '../modules/registry.ts';

export const TEASER_SIZE = { width: 1080, height: 1920 } as const;
export const MAX_QUOTE_CHARS = 280;
export const MAX_CANDIDATES = 5;
const MIN_SENTENCE = 60;

export type TeaserPresetId = 'midnight-ink' | 'warm-paper' | 'system-glow';

export interface TeaserPreset {
  id: TeaserPresetId;
  label: string;
  background: string;
  text: string;
  muted: string;
  /** Hex used for the border glow (system-glow only). */
  glow?: string;
  serif: boolean;
}

export const TEASER_PRESETS: readonly TeaserPreset[] = [
  {
    id: 'midnight-ink',
    label: 'Midnight Ink',
    background: '#0b0d12',
    text: '#f1ece2',
    muted: '#8d93a3',
    serif: true,
  },
  {
    id: 'warm-paper',
    label: 'Warm Paper',
    background: '#f6efe0',
    text: '#2b2118',
    muted: '#7a6a58',
    serif: true,
  },
  {
    id: 'system-glow',
    label: 'System Glow',
    background: '#0c2340',
    text: '#e8f1ff',
    muted: '#8fb0d8',
    glow: '#3b82f6',
    serif: false,
  },
];

export const getTeaserPreset = (id: TeaserPresetId): TeaserPreset =>
  TEASER_PRESETS.find((p) => p.id === id) ?? TEASER_PRESETS[0]!;

export interface TeaserCard {
  quote: string;
  bookTitle: string;
  chapterTitle: string;
  accent: string;
  preset: TeaserPresetId;
  badge?: string;
  showCover: boolean;
  coverUri?: string;
}

/** Hard clamp with an ellipsis, preferring a word boundary. */
export function clampQuote(text: string, max = MAX_QUOTE_CHARS): string {
  const s = text.replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  const head = space > max * 0.6 ? cut.slice(0, space) : cut;
  return `${head.replace(/[\s,;:.!?-]+$/, '')}…`;
}

/** Sentences of `text` (terminal punctuation kept, closing quotes included). */
function sentences(text: string): string[] {
  return text.match(/[^.!?…]+(?:[.!?…]+["”’')\]]*|$)/g)?.map((s) => s.trim()) ?? [];
}

interface Scored {
  text: string;
  score: number;
  order: number;
}

function score(text: string, dialogue: boolean): number {
  let s = 0;
  if (text.length >= MIN_SENTENCE && text.length <= MAX_QUOTE_CHARS) s += 3;
  if (/[.!?…]["”’')]*$/.test(text)) s += 2;
  if (dialogue) s += 2;
  if (/[?!…]/.test(text)) s += 1;
  s += Math.min(2, Math.abs(text.length - 140) < 60 ? 2 : 0);
  if (/^[A-Z“"‘']/.test(text)) s += 1;
  return s;
}

/** Up to five distinct pull-quote candidates, best first (deterministic). */
export function extractQuoteCandidates(blocks: readonly Block[], max = MAX_CANDIDATES): string[] {
  const found: Scored[] = [];
  let order = 0;
  for (const b of blocks) {
    if (b.kind !== 'prose' && b.kind !== 'dialogue') continue;
    const plain = stripInlineMarkup(b.text).replace(/\s+/g, ' ').trim();
    if (!plain) continue;
    const dialogue = b.kind === 'dialogue' || /^[“"‘']/.test(plain);
    const pool = plain.length <= MAX_QUOTE_CHARS && plain.length >= MIN_SENTENCE ? [plain] : [];
    for (const s of [...pool, ...sentences(plain)]) {
      if (s.length < MIN_SENTENCE) continue;
      found.push({ text: clampQuote(s), score: score(s, dialogue), order: order++ });
    }
  }
  const seen = new Set<string>();
  return found
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .filter((c) => (seen.has(c.text) ? false : (seen.add(c.text), true)))
    .slice(0, max)
    .map((c) => c.text);
}

/** Name of the first gimmick module used in the chapter, for the optional badge. */
export function gimmickBadge(blocks: readonly Block[]): string | undefined {
  for (const b of blocks) {
    if (b.kind !== 'module') continue;
    const name = getWriterModule(b.moduleId)?.meta.name;
    if (name) return name;
  }
  return undefined;
}

/** Quote font size (px on the 1080-wide card) and line height for a quote of `length` chars. */
export function quoteLayout(length: number): { fontSize: number; lineHeight: number } {
  const fontSize = length <= 80 ? 88 : length <= 140 ? 74 : length <= 210 ? 62 : 54;
  return { fontSize, lineHeight: Math.round(fontSize * 1.32) };
}

export interface TeaserChapterChoice {
  id: string;
  title: string;
  /** Has at least one quotable sentence. */
  quotable: boolean;
}

/** Chapter chips for the picker, in reading order. Pure. */
export function teaserChapterChoices(
  chapters: readonly { id: string; title: string; blocks: readonly Block[] }[],
): TeaserChapterChoice[] {
  return chapters.map((c) => ({
    id: c.id,
    title: c.title,
    quotable: extractQuoteCandidates(c.blocks, 1).length > 0,
  }));
}

/** The chapter chosen by default: the first quotable one, else the first. */
export const defaultTeaserChapterId = (
  choices: readonly TeaserChapterChoice[],
): string | undefined => (choices.find((c) => c.quotable) ?? choices[0])?.id;

/** The picker shows only for a novel-level teaser (no chapter given) on a book with 2+ chapters. */
export const showChapterPicker = (hasGivenChapter: boolean, chapterCount: number): boolean =>
  !hasGivenChapter && chapterCount > 1;
