import { describe, expect, it } from 'vitest';
import { joinMarkup, previewText, splitMarkup } from './tokens.ts';

describe('text field tokens', () => {
  it('splits markup into text and chips', () => {
    expect(splitMarkup("Hi {@mira}, {gold} gold. [shake]Run[/shake][pause=400] {name}'e")).toEqual([
      { kind: 'text', text: 'Hi ' },
      { kind: 'char', raw: '{@mira}', id: 'mira' },
      { kind: 'text', text: ', ' },
      { kind: 'var', raw: '{gold}', id: 'gold' },
      { kind: 'text', text: ' gold. ' },
      { kind: 'open', raw: '[shake]', name: 'shake' },
      { kind: 'text', text: 'Run' },
      { kind: 'close', raw: '[/shake]', name: 'shake' },
      { kind: 'pause', raw: '[pause=400]', ms: 400 },
      { kind: 'text', text: ' ' },
      { kind: 'var', raw: '{name}', id: 'name' },
      { kind: 'text', text: "'e" },
    ]);
  });

  it('keeps plural blocks whole and unescapes literals', () => {
    expect(splitMarkup('{n, plural, one {# coin} other {# coins}} [[x]] {{')).toEqual([
      { kind: 'icu', raw: '{n, plural, one {# coin} other {# coins}}', id: 'n' },
      { kind: 'text', text: ' [x] {' },
    ]);
  });

  it('round-trips', () => {
    for (const source of [
      'Plain.',
      '[color=accent]Red [[sic]][/color] {@mira}',
      '{n, select, she {her} other {them}}!',
      'Broken [ tag',
    ]) {
      expect(joinMarkup(splitMarkup(source))).toBe(source);
    }
  });

  it('escapes typed brackets and drops orphaned effect tags', () => {
    expect(joinMarkup([{ kind: 'text', text: 'a [b] {c}' }])).toBe('a [[b]] {{c}');
    const segments = splitMarkup('[wave]hi[/wave] [b]x[/b]').filter(
      (s) => s.kind !== 'close' || s.name !== 'wave',
    );
    expect(joinMarkup(segments)).toBe('hi [b]x[/b]');
  });

  it('previews what the reader sees', () => {
    expect(previewText('[i]Hello[/i]   {@mira}!', () => 'Mira')).toBe('Hello Mira!');
  });
});
