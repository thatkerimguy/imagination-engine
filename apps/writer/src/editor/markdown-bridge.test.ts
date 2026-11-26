import { describe, expect, it } from 'vitest';
import {
  fromEnriched,
  isEnrichedSafe,
  plainToSource,
  sourceToPlain,
  toEnriched,
} from './markdown-bridge.ts';

describe('isEnrichedSafe', () => {
  it('accepts plain prose with bold, italic and strike', () => {
    expect(isEnrichedSafe('The **tide** rose, *slowly*.\n\nThen ~~nothing~~.')).toBe(true);
    expect(isEnrichedSafe('Met @Mira Okafor at dawn — 3 + 4.')).toBe(true);
  });
  it('rejects anything the native editor would rewrite', () => {
    for (const s of [
      '==hi==',
      '{fg:#ff0000}red{/fg}',
      'a{{comment:x}}',
      '++under++',
      'snake_case',
      'esc \\*',
      '[[Harbour District]]',
      '# Heading',
      '- item',
      'one\n\n1. two',
    ])
      expect(isEnrichedSafe(s), s).toBe(false);
  });
});

describe('fromEnriched', () => {
  it('turns one-line paragraphs into blank-line paragraphs', () => {
    expect(fromEnriched('one\ntwo\n\nthree')).toBe('one\n\ntwo\n\nthree');
  });
  it('maps both underline spellings to ++', () => {
    expect(fromEnriched('an _under_ and __twice__ word')).toBe('an ++under++ and ++twice++ word');
    expect(fromEnriched('**bold** *it* ~~s~~')).toBe('**bold** *it* ~~s~~');
  });
  it('round-trips a safe source', () => {
    const src = 'The **tide** rose.\n\n*Run*, she said.';
    expect(fromEnriched(toEnriched(src))).toBe(src);
  });
});

describe('plain ↔ source offsets', () => {
  const src = 'a **b** c\n\n*d*';
  // native text: "a b c\nd"
  it('skips delimiters and collapses the paragraph gap', () => {
    expect(plainToSource(src, 0)).toBe(0);
    expect(plainToSource(src, 2)).toBe(4); // "b"
    expect(plainToSource(src, 4)).toBe(8); // "c"
    expect(plainToSource(src, 6)).toBe(12); // "d"
    expect(plainToSource(src, 99)).toBe(src.length);
  });
  it('inverts back to plain offsets', () => {
    expect(sourceToPlain(src, 4)).toBe(2);
    expect(sourceToPlain(src, 12)).toBe(6);
    expect(sourceToPlain(src, src.length)).toBe(7);
  });
});
