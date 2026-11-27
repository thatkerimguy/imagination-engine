import { describe, expect, it } from 'vitest';
import { formatNumber, resolveLocale, t, tn, type Locale } from './i18n.ts';
import { en, type StringKey } from './strings-en.ts';
import { es } from './strings-es.ts';
import { tr } from './strings-tr.ts';

const dicts: Readonly<Record<Exclude<Locale, 'en'>, Record<StringKey, string>>> = { tr, es };
const keys = Object.keys(en) as StringKey[];
const tokens = (s: string): string[] =>
  [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1] ?? '').sort();

describe.each(['tr', 'es'] as const)('%s dictionary', (loc) => {
  const d = dicts[loc];

  it('has exactly the English keys', () => {
    expect(Object.keys(d).sort()).toEqual([...keys].sort());
  });

  it('keeps the same {{placeholders}} as English', () => {
    for (const k of keys) expect(tokens(d[k]), k).toEqual(tokens(en[k]));
  });

  it('has no empty strings', () => {
    for (const k of keys) expect(d[k].trim().length, k).toBeGreaterThan(0);
  });
});

describe('layout budgets', () => {
  const all: Record<Locale, Record<StringKey, string>> = { en, tr, es };
  it('tab labels fit 10 chars in tr/es', () => {
    for (const d of [tr, es])
      for (const k of keys.filter((x) => x.startsWith('tab.')))
        expect(d[k].length, k).toBeLessThanOrEqual(10);
  });

  it('compile.fmt hints fit their grid tile in every locale', () => {
    for (const d of Object.values(all))
      for (const k of keys.filter((x) => x.startsWith('compile.fmt.'))) {
        const max = k === 'compile.fmt.royalroad' ? 16 : 22;
        expect(d[k].length, k).toBeLessThanOrEqual(max);
      }
  });
});

describe('Turkish and plural helpers', () => {
  it('resolves tr/es/fallback locales', () => {
    expect(resolveLocale('system', [{ languageCode: 'tr' }])).toBe('tr');
    expect(resolveLocale('system', ['tr-TR'])).toBe('tr');
    expect(resolveLocale('system', ['tr_TR'])).toBe('tr');
    expect(resolveLocale('system', ['es-MX'])).toBe('es');
    expect(resolveLocale('system', ['fr-FR'])).toBe('en');
    expect(resolveLocale('tr', [{ languageCode: 'en' }])).toBe('tr');
  });

  it('formats Turkish numbers and strings', () => {
    expect(formatNumber(12345, 'tr')).toBe('12.345');
    expect(t('tab.library', undefined, 'tr')).toBe('Kitaplık');
  });

  it('pluralizes per locale', () => {
    expect(tn('time.days', 3, undefined, 'tr')).toBe('3 gün önce');
    expect(tn('time.days', 1, undefined, 'tr')).toBe('1 gün önce');
    expect(tn('time.days', 3, undefined, 'es')).toBe('hace 3 días');
    expect(tn('time.days', 1, undefined, 'es')).toBe('hace 1 día');
    expect(tn('trash.deletesIn', 1)).toBe('Deletes in 1 day');
    expect(tn('backlinks.count', 2)).toBe('Referenced in 2 places');
  });
});
