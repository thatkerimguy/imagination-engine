import { describe, expect, it } from 'vitest';
import { detectLocale, isLocale } from './locales.ts';
import { createTranslator, defineCatalogs, formatMessage, pluralCategory } from './messages.ts';
import { capitalize, foldForSearch, lower, matchesSearch, sortText, upper } from './text.ts';

describe('locales', () => {
  it('detects the first supported language', () => {
    expect(detectLocale(['de-DE', 'tr-TR', 'en'])).toBe('tr');
    expect(detectLocale(['en-GB'])).toBe('en');
    expect(detectLocale(['fr'])).toBe('en');
    expect(isLocale('tr')).toBe(true);
    expect(isLocale('TR')).toBe(false);
  });
});

describe('Turkish-aware casing', () => {
  it('handles dotted and dotless i', () => {
    expect(upper('istanbul', 'tr')).toBe('İSTANBUL');
    expect(upper('istanbul', 'en')).toBe('ISTANBUL');
    expect(lower('IŞIK', 'tr')).toBe('ışık');
    expect(lower('İZMİR', 'tr')).toBe('izmir');
    expect(capitalize('izmir', 'tr')).toBe('İzmir');
    expect(capitalize('ılık', 'tr')).toBe('Ilık');
    expect(capitalize('', 'tr')).toBe('');
  });
});

describe('collation', () => {
  it('sorts Turkish letters in Turkish order', () => {
    const words = ['zeytin', 'şeker', 'su', 'incir', 'ıhlamur', 'çay', 'cam'];
    expect(sortText(words, 'tr', (w) => w)).toEqual([
      'cam',
      'çay',
      'ıhlamur',
      'incir',
      'su',
      'şeker',
      'zeytin',
    ]);
  });

  it('sorts numbers naturally', () => {
    expect(sortText(['Bölüm 10', 'Bölüm 2', 'Bölüm 1'], 'tr', (w) => w)).toEqual([
      'Bölüm 1',
      'Bölüm 2',
      'Bölüm 10',
    ]);
  });
});

describe('search folding', () => {
  it('matches across case, dots and accents', () => {
    expect(foldForSearch('İSTANBUL')).toBe('istanbul');
    expect(foldForSearch('ISTANBUL')).toBe('istanbul');
    expect(foldForSearch('Işık  Çağlar')).toBe('isik caglar');
    expect(matchesSearch('Çağlayan Şelalesi', 'caglayan sel')).toBe(true);
    expect(matchesSearch('Night Drive', 'drive night')).toBe(true);
    expect(matchesSearch('Night Drive', 'day')).toBe(false);
  });
});

describe('messages', () => {
  const catalogs = defineCatalogs({
    en: { greet: 'Hello, {name}!', gold: '{n} gold' },
    tr: { greet: 'Merhaba {name}!', gold: '{n} altın' },
  });

  it('translates with parameters and locale number formats', () => {
    expect(createTranslator(catalogs, 'en')('greet', { name: 'Mira' })).toBe('Hello, Mira!');
    expect(createTranslator(catalogs, 'tr')('gold', { n: 12500 })).toBe('12.500 altın');
    expect(createTranslator(catalogs, 'en')('gold', { n: 12500 })).toBe('12,500 gold');
  });

  it('leaves unknown placeholders visible', () => {
    expect(formatMessage('Hi {who}', {}, 'en')).toBe('Hi {who}');
  });

  it('picks plural cases, with # as the count', () => {
    const lines = '{n, plural, one {# line} other {# lines}} left';
    expect(formatMessage(lines, { n: 1 }, 'en')).toBe('1 line left');
    expect(formatMessage(lines, { n: 1200 }, 'en')).toBe('1,200 lines left');
    expect(formatMessage('{n, plural, =0 {none} other {#}}', { n: 0 }, 'en')).toBe('none');
    // Turkish has only "other" after numbers.
    expect(formatMessage('{n, plural, other {# satır}} kaldı', { n: 1 }, 'tr')).toBe(
      '1 satır kaldı',
    );
    // Plain placeholders around a plural still fill in; a plural without its number stays as is.
    expect(
      formatMessage('{who}: {n, plural, one {# win} other {# wins}}', { who: 'Mira', n: 2 }, 'en'),
    ).toBe('Mira: 2 wins');
    expect(formatMessage('{n, plural, other {#}}', {}, 'en')).toBe('{n, plural, other {#}}');
  });

  it('exposes plural categories', () => {
    expect(pluralCategory('en', 1)).toBe('one');
    expect(pluralCategory('en', 2)).toBe('other');
  });
});
