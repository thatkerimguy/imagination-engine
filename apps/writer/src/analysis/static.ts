// Static (on-demand) text analysis: word frequency and extractable items.
import type { Block } from '@kn/core';
import { isGrammarWord } from './grammar-words.ts';
import { collectParagraphs, splitSentences, tokenize } from './text-split.ts';

export interface FrequencyOptions {
  filter: 'all' | 'content' | 'grammar';
  minLength: number;
  limit?: number;
}

export function wordFrequency(
  blocks: readonly Block[],
  opts: FrequencyOptions,
): Array<{ word: string; count: number }> {
  const counts = new Map<string, number>();
  for (const p of collectParagraphs(blocks, false)) {
    for (const t of tokenize(p.text)) {
      const word = t.toLowerCase().replace(/[’‘]/g, "'");
      if (word.length < opts.minLength) continue;
      const g = isGrammarWord(word);
      if ((opts.filter === 'content' && g) || (opts.filter === 'grammar' && !g)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  const sorted = [...counts].map(([word, count]) => ({ word, count }));
  sorted.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
  return opts.limit === undefined ? sorted : sorted.slice(0, opts.limit);
}

export interface ExtractedInfo {
  emails: string[];
  urls: string[];
  hashtags: string[];
  phones: string[];
  quotes: string[];
  longSentences: string[];
}

export const LONG_SENTENCE_WORDS = 25;

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
const HASHTAG_RE = /(?<![\w&])#[\p{L}][\p{L}\p{N}_]*/gu;
const PHONE_RE =
  /(?<![\w])(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}(?:[\s.-]?\d{1,4})?(?![\w])/g;
const QUOTE_RE = /"([^"\n]+)"|“([^”\n]+)”/g;

const uniq = (items: Iterable<string>): string[] => [...new Set(items)];

export function extractInfo(blocks: readonly Block[]): ExtractedInfo {
  const paras = collectParagraphs(blocks, false).map((p) => p.text);
  const all = paras.join('\n');
  const emails = all.match(EMAIL_RE) ?? [];
  const urls = (all.match(URL_RE) ?? []).map((u) => u.replace(/[.,;:!?)\]'"”’]+$/, ''));
  const hashtags = all.match(HASHTAG_RE) ?? [];
  const phones = (all.replace(EMAIL_RE, ' ').match(PHONE_RE) ?? [])
    .map((p) => p.trim())
    .filter((p) => p.replace(/\D/g, '').length >= 7);
  const quotes = [...all.matchAll(QUOTE_RE)].map((m) => (m[1] ?? m[2] ?? '').trim());
  const longSentences = paras
    .flatMap(splitSentences)
    .filter((s) => tokenize(s).length > LONG_SENTENCE_WORDS);
  return {
    emails: uniq(emails),
    urls: uniq(urls),
    hashtags: uniq(hashtags),
    phones: uniq(phones),
    quotes: uniq(quotes.filter(Boolean)),
    longSentences: uniq(longSentences),
  };
}
