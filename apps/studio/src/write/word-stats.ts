import type { Locale } from '@ie/i18n';
import { parseMarkup, type Block, type LocalText, type MarkupNode } from '@ie/story';
import { childLists } from '../project/tree.ts';

/** Words a reader meets in one passage and roughly how long it takes to read them. */
export interface WordStats {
  readonly words: number;
  /** Whole minutes, at least 1 when there is any text. */
  readonly minutes: number;
}

/** A relaxed reading pace for fiction on a phone. */
const WORDS_PER_MINUTE = 200;

function wordsIn(text: string, locale: Locale): number {
  const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
  let count = 0;
  for (const part of segmenter.segment(text)) if (part.isWordLike) count++;
  return count;
}

function wordsInNodes(nodes: readonly MarkupNode[], locale: Locale): number {
  let count = 0;
  for (const node of nodes) {
    if (node.t === 'text') count += wordsIn(node.v, locale);
    else if (node.t === 'var' || node.t === 'char' || node.t === 'hash') count += 1;
    else if (node.t === 'fx') count += wordsInNodes(node.children, locale);
    else if (node.t === 'plural' || node.t === 'select') {
      // A reader sees one case; the first stands in for all of them.
      const first = Object.values(node.cases)[0];
      if (first) count += wordsInNodes(first, locale);
    }
  }
  return count;
}

/** Words in one text, with markup tags and names counted as a reader sees them. */
export function countWords(source: string, locale: Locale): number {
  if (!source.trim()) return 0;
  try {
    return wordsInNodes(parseMarkup(source), locale);
  } catch {
    return wordsIn(source, locale);
  }
}

function textsOf(block: Block): (LocalText | undefined)[] {
  switch (block.type) {
    case 'narration':
    case 'dialogue':
      return [block.text];
    case 'choice':
      return [block.prompt, ...block.options.map((o) => o.text)];
    default:
      return [];
  }
}

/** Every line, choice and nested branch of a passage, in the language being written. */
export function wordStats(blocks: readonly Block[], locale: Locale): WordStats {
  let words = 0;
  const walk = (list: readonly Block[]) => {
    for (const block of list) {
      for (const text of textsOf(block)) words += countWords(text?.[locale] ?? '', locale);
      for (const [, child] of childLists(block)) walk(child);
    }
  };
  walk(blocks);
  return { words, minutes: words === 0 ? 0 : Math.max(1, Math.round(words / WORDS_PER_MINUTE)) };
}
