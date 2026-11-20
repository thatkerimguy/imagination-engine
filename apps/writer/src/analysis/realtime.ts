// Pure, dependency-free text analysis: the 27 real-time metrics for a chapter's blocks.
import type { Block } from '@kn/core';
import { isGrammarWord } from './grammar-words.ts';
import type { AnalyzeOptions, DocumentMetrics } from './metrics.ts';
import { countSyllables, mattr } from './text-lexical.ts';
import { readability } from './text-readability.ts';
import { collectParagraphs, splitSentences, tokenize } from './text-split.ts';

export { createTypingMeter } from './text-typing.ts';

const norm = (t: string): string => t.toLowerCase().replace(/[’‘]/g, "'");
const div = (a: number, b: number): number => (b > 0 ? a / b : 0);

/** Metrics for prose + dialogue (and chat lines with `includeChat`). Paragraphs are joined with a blank line (\n\n) for character counts. */
export function analyzeDocument(
  blocks: readonly Block[],
  opts: AnalyzeOptions = {},
): DocumentMetrics {
  const paras = collectParagraphs(blocks, opts.includeChat ?? false);
  const text = paras.map((p) => p.text).join('\n\n');
  const tokens: string[] = [];
  let dialogueWords = 0;
  let sentences = 0;
  let syllables = 0;
  let complexWords = 0;
  let letters = 0;
  let grammar = 0;
  for (const p of paras) {
    const words = tokenize(p.text);
    if (p.dialogue) dialogueWords += words.length;
    sentences += Math.max(splitSentences(p.text).length, words.length > 0 ? 1 : 0);
    for (const w of words) {
      const n = norm(w);
      tokens.push(n);
      const syl = countSyllables(w);
      syllables += syl;
      if (syl >= 3) complexWords++;
      letters += w.replace(/[^\p{L}\p{N}]/gu, '').length;
      if (isGrammarWord(n)) grammar++;
    }
  }
  const words = tokens.length;
  const unique = new Set(tokens).size;
  const r = readability({ words, sentences, syllables, complexWords, letters });
  const typing = opts.typing ?? { cpm: 0, wpm: 0 };
  return {
    chars: text.length,
    charsNoSpaces: text.replace(/\s/g, '').length,
    words,
    sentences,
    paragraphs: paras.length,
    typingCpm: typing.cpm,
    typingWpm: typing.wpm,
    uniqueWords: unique,
    uniquePct: div(unique, words) * 100,
    mattr: mattr(tokens),
    lexicalDensity: div(words - grammar, words) * 100,
    grammarWords: grammar,
    contentWords: words - grammar,
    syllables,
    complexWords,
    avgWordLength: div(letters, words),
    avgSentenceLength: div(words, sentences),
    avgParagraphLength: div(words, paras.length),
    readingTime: words / 225,
    speakingTime: words / 140,
    ...r,
    dialogueShare: div(dialogueWords, words) * 100,
    smogIsEstimate: sentences < 30,
  };
}
