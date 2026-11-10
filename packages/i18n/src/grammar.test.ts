import { describe, expect, it } from 'vitest';
import { indefiniteArticle } from './english.ts';
import { harmonizeSuffix, turkishNumberReading, turkishReading } from './turkish.ts';

const attach = (value: string | number, suffix: string, suffixAs?: string) =>
  `${value}'${harmonizeSuffix(value, suffix, suffixAs ? { suffixAs } : {})}`;

describe('Turkish suffixes', () => {
  it.each([
    // [value, written suffix, expected] — the plan's table first
    ['Kerim', 'e', "Kerim'e"],
    ['Ayşe', 'e', "Ayşe'ye"],
    ['Can', 'e', "Can'a"],
    ['Ahmet', 'e', "Ahmet'e"],
    ['Kerim', 'de', "Kerim'de"],
    ['Ayşe', 'de', "Ayşe'de"],
    ['Can', 'de', "Can'da"],
    ['Ahmet', 'de', "Ahmet'te"],
    ['Kerim', 'in', "Kerim'in"],
    ['Ayşe', 'in', "Ayşe'nin"],
    ['Can', 'in', "Can'ın"],
    ['Ahmet', 'in', "Ahmet'in"],
  ])('%s + %s → %s', (value, suffix, expected) => {
    expect(attach(value, suffix)).toBe(expected);
  });

  it('accepts the suffix written in any of its forms', () => {
    for (const written of ['e', 'a', 'ye', 'ya']) expect(attach('Ayşe', written)).toBe("Ayşe'ye");
    for (const written of ['de', 'da', 'te', 'ta']) expect(attach('Can', written)).toBe("Can'da");
    for (const written of ['in', 'ın', 'nin', 'nun'])
      expect(attach('Umut', written)).toBe("Umut'un");
  });

  it('covers accusative, ablative, instrumental and rounded vowels', () => {
    expect(attach('Ayşe', 'i')).toBe("Ayşe'yi");
    expect(attach('Gül', 'i')).toBe("Gül'ü");
    expect(attach('Umut', 'i')).toBe("Umut'u");
    expect(attach('Ahmet', 'den')).toBe("Ahmet'ten");
    expect(attach('Can', 'den')).toBe("Can'dan");
    expect(attach('Kerim', 'le')).toBe("Kerim'le");
    expect(attach('Ayşe', 'le')).toBe("Ayşe'yle");
    expect(attach('Can', 'yle')).toBe("Can'la");
    expect(attach('Ayşe', 'si')).toBe("Ayşe'si");
    expect(attach('Kerim', 'si')).toBe("Kerim'i");
  });

  it('handles chains and endings that never change', () => {
    expect(attach('Ahmet', 'deki')).toBe("Ahmet'teki");
    expect(attach('Can', 'deki')).toBe("Can'daki");
    expect(attach('Can', 'inki')).toBe("Can'ınki");
    expect(attach('Umut', 'dır')).toBe("Umut'tur");
    expect(attach('Gül', 'dir')).toBe("Gül'dür");
    expect(attach('Can', 'ler')).toBe("Can'lar");
    expect(attach('Ayşe', 'yken')).toBe("Ayşe'yken");
    expect(attach('Kerim', 'siz')).toBe("Kerim'siz");
    expect(attach('Ahmet', 'ce')).toBe("Ahmet'çe");
  });

  it('reads numbers aloud', () => {
    expect(attach(3, 'e')).toBe("3'e");
    expect(attach(6, 'e')).toBe("6'ya");
    expect(attach(10, 'e')).toBe("10'a");
    expect(attach(3, 'de')).toBe("3'te");
    expect(attach(40, 'de')).toBe("40'ta");
    expect(attach(100, 'e')).toBe("100'e");
    expect(attach(2000, 'in')).toBe("2000'in");
    expect(attach(9, 'i')).toBe("9'u");
    expect(turkishNumberReading(3500)).toBe('yüz');
    expect(turkishNumberReading(2_000_000)).toBe('milyon');
    expect(turkishNumberReading('2,5')).toBe('beş');
    expect(turkishNumberReading('1.000')).toBe('bin');
    expect(turkishReading('Bölüm 7')).toBe('yedi');
  });

  it('spells acronyms and honours overrides', () => {
    expect(attach('TDK', 'e')).toBe("TDK'ya");
    expect(attach('TRT', 'e')).toBe("TRT'ye");
    expect(attach('NASA', 'e')).toBe("NASA'ya");
    expect(attach('Kemal', 'e')).toBe("Kemal'a");
    expect(attach('Kemal', 'e', 'Kemel')).toBe("Kemal'e");
  });

  it('keeps shouted suffixes in capitals', () => {
    expect(`KERİM'${harmonizeSuffix('KERİM', 'E')}`).toBe("KERİM'E");
    expect(`AYŞE'${harmonizeSuffix('AYŞE', 'İN')}`).toBe("AYŞE'NİN");
  });
});

describe('English articles', () => {
  it.each([
    ['apple', 'an'],
    ['pear', 'a'],
    ['hour', 'an'],
    ['honest man', 'an'],
    ['unicorn', 'a'],
    ['umbrella', 'an'],
    ['European', 'a'],
    ['one-way ticket', 'a'],
    ['FBI agent', 'an'],
    ['UFO', 'a'],
    ['NASA probe', 'a'],
    ['8-bit song', 'an'],
    ['11th hour', 'an'],
    ['12th night', 'a'],
  ])('%s → %s', (word, article) => {
    expect(indefiniteArticle(word)).toBe(article);
  });
});
