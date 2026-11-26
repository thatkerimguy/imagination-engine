import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDate, formatNumber, resolveLocale, t, translator } from './i18n.ts';
import { en } from './strings-en.ts';
import { es } from './strings-es.ts';

describe('t', () => {
  it('returns English by default and Spanish on request', () => {
    expect(t('tab.library')).toBe('Library');
    expect(t('tab.library', undefined, 'es')).toBe('Biblioteca');
  });

  it('interpolates params, leaving unknown placeholders intact', () => {
    expect(t('library.saved', { name: 'a.json' })).toBe('Saved a.json');
    expect(t('library.saved', {}, 'en')).toBe('Saved {{name}}');
    expect(t('time.minutes.other', { n: 5 }, 'es')).toBe('hace 5 minutos');
  });

  it('falls back to English when a locale lacks a key', () => {
    const saved = es['tab.notes'];
    (es as Record<string, string | undefined>)['tab.notes'] = undefined;
    expect(t('tab.notes', undefined, 'es')).toBe('Notes');
    (es as Record<string, string>)['tab.notes'] = saved;
  });

  it('falls back to the key itself for an unknown key', () => {
    expect(t('nope.nothing' as never)).toBe('nope.nothing');
  });

  it('translator binds the locale', () => {
    expect(translator('es')('tab.search')).toBe('Buscar');
  });

  it('keeps Spanish complete and tab labels short', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
    for (const k of ['tab.library', 'tab.notes', 'tab.search'] as const)
      expect(es[k].length).toBeLessThanOrEqual(10);
  });
});

describe('resolveLocale', () => {
  it('honours an explicit setting', () => {
    expect(resolveLocale('es', [{ languageCode: 'en' }])).toBe('es');
    expect(resolveLocale('en', ['es-MX'])).toBe('en');
  });

  it('system picks the first supported device locale', () => {
    expect(resolveLocale('system', [{ languageCode: 'fr' }, { languageCode: 'es' }])).toBe('es');
    expect(resolveLocale('system', ['es-MX', 'en-US'])).toBe('es');
    expect(resolveLocale('system', ['pt_BR', 'en_GB'])).toBe('en');
  });

  it('system falls back to English', () => {
    expect(resolveLocale('system', [])).toBe('en');
    expect(resolveLocale('system', [{ languageCode: null }, { languageCode: 'de' }])).toBe('en');
  });
});

describe('formatNumber / formatDate', () => {
  afterEach(() => vi.restoreAllMocks());

  it('groups per locale', () => {
    expect(formatNumber(12345, 'en')).toBe('12,345');
    expect(formatNumber(12345, 'es')).toBe('12.345');
    expect(formatNumber(1234567, 'es')).toBe('1.234.567');
  });

  it('es leaves 4-digit numbers ungrouped', () => {
    expect(formatNumber(1234, 'es')).toBe('1234');
    expect(formatNumber(1234, 'en')).toBe('1,234');
  });

  it('formats dates per locale and survives bad input', () => {
    expect(formatDate('2026-03-05T12:00:00Z', 'en')).toMatch(/Mar.*2026/);
    expect(formatDate('2026-03-05T12:00:00Z', 'es')).toMatch(/mar.*2026/);
    expect(formatDate('not a date', 'en')).toBe('not a date');
  });

  it('falls back when Intl throws', () => {
    vi.spyOn(Intl, 'NumberFormat').mockImplementation(() => {
      throw new RangeError('boom');
    });
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new RangeError('boom');
    });
    expect(formatNumber(12345, 'es')).toBe('12345');
    expect(formatDate('2026-03-05T12:00:00Z', 'es')).toBe('2026-03-05');
  });
});
