import { describe, expect, it } from 'vitest';
import { insertComment, insertText, toggleMark, wrapColor } from './inline-edit.ts';
import {
  hasWriterOnlyMarkup,
  inlineRuns,
  parseInline,
  sanitizeForReader,
  stripInlineMarkup,
} from './inline-markup.ts';

describe('parseInline', () => {
  it('parses nested core and writer-only spans', () => {
    expect(parseInline('a **b *c* d** {fg:#ff0000}red{/fg}{{comment:fix}}')).toEqual([
      { type: 'text', text: 'a ' },
      {
        type: 'mark',
        mark: 'bold',
        children: [
          { type: 'text', text: 'b ' },
          { type: 'mark', mark: 'italic', children: [{ type: 'text', text: 'c' }] },
          { type: 'text', text: ' d' },
        ],
      },
      { type: 'text', text: ' ' },
      { type: 'color', channel: 'fg', color: '#ff0000', children: [{ type: 'text', text: 'red' }] },
      { type: 'comment', note: 'fix' },
    ]);
  });

  it('keeps unmatched delimiters and escapes literal', () => {
    expect(stripInlineMarkup('2 \\* 3 and a lone * star, ==x')).toBe(
      '2 * 3 and a lone * star, ==x',
    );
  });

  it('flattens into styled runs', () => {
    const runs = inlineRuns('++u ==h==++{bg:#00ff00}g{/bg}');
    expect(runs.map((r) => [r.text, r.underline, r.highlight, r.bg])).toEqual([
      ['u ', true, false, undefined],
      ['h', true, true, undefined],
      ['g', false, false, '#00ff00'],
    ]);
  });
});

describe('strip / sanitize', () => {
  const src = '**Bold** {fg:#AA0000}red *it*{/fg} ~~s~~{{comment:check this}} ==hi== \\*';
  it('strips everything for analyzers', () => {
    expect(stripInlineMarkup(src)).toBe('Bold red it s hi *');
  });
  it('keeps core spans for the reader and drops writer-only tokens', () => {
    expect(sanitizeForReader(src)).toBe('**Bold** red *it* ~~s~~ ==hi== \\*');
    expect(hasWriterOnlyMarkup(src)).toBe(true);
  });
  it('is the identity on text without writer-only tokens', () => {
    const plain = 'A {brace} and **bold** stay {fg:nothex}.';
    expect(sanitizeForReader(plain)).toBe(plain);
    expect(hasWriterOnlyMarkup(plain)).toBe(false);
  });
});

describe('toggleMark', () => {
  it('wraps a selection and keeps it selected', () => {
    expect(toggleMark('one two', { start: 4, end: 7 }, 'bold')).toEqual({
      text: 'one **two**',
      selection: { start: 6, end: 9 },
    });
  });
  it('unwraps when delimiters sit just outside the selection', () => {
    expect(toggleMark('one **two**', { start: 6, end: 9 }, 'bold')).toEqual({
      text: 'one two',
      selection: { start: 4, end: 7 },
    });
  });
  it('unwraps when the selection includes the delimiters', () => {
    expect(toggleMark('==x==', { start: 0, end: 5 }, 'highlight').text).toBe('x');
  });
  it('does not treat bold as italic', () => {
    expect(toggleMark('**two**', { start: 2, end: 5 }, 'italic').text).toBe('***two***');
  });
  it('inserts an empty pair at the caret', () => {
    expect(toggleMark('ab', { start: 1, end: 1 }, 'strike')).toEqual({
      text: 'a~~~~b',
      selection: { start: 3, end: 3 },
    });
  });
});

describe('wrapColor / insertComment / insertText', () => {
  it('wraps in a colour span', () => {
    expect(wrapColor('hello', { start: 0, end: 5 }, 'bg', '#123456').text).toBe(
      '{bg:#123456}hello{/bg}',
    );
  });
  it('inserts a comment after the selection', () => {
    expect(insertComment('ab', { start: 0, end: 1 }, ' note }} ').text).toBe(
      'a{{comment:note } }}}b',
    );
  });
  it('inserts a tab at the caret', () => {
    expect(insertText('ab', { start: 1, end: 1 }, '\t')).toEqual({
      text: 'a\tb',
      selection: { start: 2, end: 2 },
    });
  });
});
