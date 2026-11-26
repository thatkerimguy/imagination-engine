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

/** Per-block counts: a block's paragraphs never depend on its neighbours. */
interface BlockStats {
  tokens: string[];
  paragraphs: number;
  chars: number;
  charsNoSpaces: number;
  dialogueWords: number;
  sentences: number;
  syllables: number;
  complexWords: number;
  letters: number;
  grammar: number;
}

/**
 * Edits replace only the edited block object, so stats are cached per block identity: a single
 * keystroke in a 10,000-word chapter re-tokenises one block, not all of them (DIRECTIVE-06 D3).
 */
const caches = { prose: new WeakMap<Block, BlockStats>(), chat: new WeakMap<Block, BlockStats>() };

function statsOf(block: Block, includeChat: boolean): BlockStats {
  const cache = includeChat ? caches.chat : caches.prose;
  const hit = cache.get(block);
  if (hit) return hit;
  const st: BlockStats = {
    tokens: [],
    paragraphs: 0,
    chars: 0,
    charsNoSpaces: 0,
    dialogueWords: 0,
    sentences: 0,
    syllables: 0,
    complexWords: 0,
    letters: 0,
    grammar: 0,
  };
  for (const p of collectParagraphs([block], includeChat)) {
    st.paragraphs++;
    st.chars += p.text.length;
    st.charsNoSpaces += p.text.replace(/\s/g, '').length;
    const words = tokenize(p.text);
    if (p.dialogue) st.dialogueWords += words.length;
    st.sentences += Math.max(splitSentences(p.text).length, words.length > 0 ? 1 : 0);
    for (const w of words) {
      const n = norm(w);
      st.tokens.push(n);
      const syl = countSyllables(w);
      st.syllables += syl;
      if (syl >= 3) st.complexWords++;
      st.letters += w.replace(/[^\p{L}\p{N}]/gu, '').length;
      if (isGrammarWord(n)) st.grammar++;
    }
  }
  cache.set(block, st);
  return st;
}

/** Metrics for prose + dialogue (and chat lines with `includeChat`). Paragraphs are joined with a blank line for character counts. */
export function analyzeDocument(
  blocks: readonly Block[],
  opts: AnalyzeOptions = {},
): DocumentMetrics {
  const includeChat = opts.includeChat ?? false;
  const tokens: string[] = [];
  let paragraphs = 0;
  let chars = 0;
  let charsNoSpaces = 0;
  let dialogueWords = 0;
  let sentences = 0;
  let syllables = 0;
  let complexWords = 0;
  let letters = 0;
  let grammar = 0;
  for (const b of blocks) {
    const st = statsOf(b, includeChat);
    if (st.paragraphs === 0) continue;
    for (const t of st.tokens) tokens.push(t);
    paragraphs += st.paragraphs;
    chars += st.chars;
    charsNoSpaces += st.charsNoSpaces;
    dialogueWords += st.dialogueWords;
    sentences += st.sentences;
    syllables += st.syllables;
    complexWords += st.complexWords;
    letters += st.letters;
    grammar += st.grammar;
  }
  const words = tokens.length;
  const unique = new Set(tokens).size;
  const r = readability({ words, sentences, syllables, complexWords, letters });
  const typing = opts.typing ?? { cpm: 0, wpm: 0 };
  return {
    // Paragraphs are joined by a blank line (two characters) for the character count.
    chars: chars + Math.max(0, paragraphs - 1) * 2,
    charsNoSpaces,
    words,
    sentences,
    paragraphs,
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
    avgParagraphLength: div(words, paragraphs),
    readingTime: words / 225,
    speakingTime: words / 140,
    ...r,
    dialogueShare: div(dialogueWords, words) * 100,
    smogIsEstimate: sentences < 30,
  };
}
