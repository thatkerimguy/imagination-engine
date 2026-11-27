// Text extraction and splitting shared by the analyzers: paragraphs, words, sentences.
import type { Block } from '@kn/core';
import { stripInlineMarkup } from '../editor/inline-markup.ts';

export interface Para {
  text: string;
  dialogue: boolean;
}

/** Chat cues: the v2 `chat-thread` engine (records `{ text }`) and the pre-v2 module (strings). */
export const CHAT_MODULE_IDS: readonly string[] = ['chat-thread', 'gits-cyberbrain-chat'];

/** Words keep inner apostrophes / hyphens ("don't", "well-known") and decimals ("3.14"). */
const WORD_RE = /[\p{L}\p{N}]+(?:(?:['’-]|(?<=\d)[.,](?=\d))[\p{L}\p{N}]+)*/gu;

export const tokenize = (text: string): string[] => text.match(WORD_RE) ?? [];

/** Paragraphs in reading order: prose / dialogue blocks (+ chat lines), split on blank lines. */
export function collectParagraphs(blocks: readonly Block[], includeChat: boolean): Para[] {
  const out: Para[] = [];
  const add = (raw: string, dialogue: boolean): void => {
    for (const part of stripInlineMarkup(raw).split(/\n[^\S\n]*\n/)) {
      const text = part.trim();
      if (text) out.push({ text, dialogue });
    }
  };
  for (const b of blocks) {
    if (b.kind === 'prose') add(b.text, false);
    else if (b.kind === 'dialogue') add(b.text, true);
    else if (includeChat && b.kind === 'module' && CHAT_MODULE_IDS.includes(b.moduleId)) {
      const lines = b.props.messages;
      if (!Array.isArray(lines)) continue;
      for (const l of lines) {
        const text = typeof l === 'string' ? l : (l as { text?: unknown } | null)?.text;
        if (typeof text === 'string') add(text, false);
      }
    }
  }
  return out;
}

const ALWAYS_ABBR = new Set(
  'mr. mrs. ms. dr. prof. sr. jr. st. mt. vs. e.g. i.e. no. vol. ch. fig.'.split(' '),
);
/** Can legitimately end a sentence, so only protected when a lowercase / digit word follows. */
const MAYBE_ABBR = new Set(['etc.', 'a.m.', 'p.m.']);

const TERMINATOR = /[.!?…]+["'”’)\]]*(?=\s|$)/g;

function isProtected(text: string, index: number, core: string, end: number): boolean {
  const next = /\S/.exec(text.slice(end))?.[0];
  if (core === '.') {
    const chunk = /[\p{L}.]+$/u.exec(text.slice(0, index))?.[0] ?? '';
    const abbr = `${chunk}.`.toLowerCase();
    if (ALWAYS_ABBR.has(abbr)) return true;
    if (/^\p{Lu}$/u.test(chunk)) return true; // initials: "J. K. Rowling"
    return MAYBE_ABBR.has(abbr) && next !== undefined && /[\p{Ll}\d]/u.test(next);
  }
  if (/[!?]/.test(core)) return false;
  // Ellipsis: a boundary only when the next word starts a new capitalised sentence.
  return next !== undefined && /[\p{Ll}\d]/u.test(next);
}

/** Splits one paragraph into sentences; trailing text without punctuation is a sentence too. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (const m of text.matchAll(TERMINATOR)) {
    const end = m.index + m[0].length;
    const core = m[0].replace(/["'”’)\]]+$/, '');
    if (isProtected(text, m.index, core, end)) continue;
    out.push(text.slice(start, end).trim());
    start = end;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out.filter((s) => tokenize(s).length > 0);
}
