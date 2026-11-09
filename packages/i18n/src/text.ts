import { localeTag, type Locale } from './locales.ts';

/** Locale-aware uppercase: Turkish `i` becomes `İ`, `ı` becomes `I`. Never use `toUpperCase()` on user text. */
export function upper(text: string, locale: Locale): string {
  return text.toLocaleUpperCase(localeTag(locale));
}

/** Locale-aware lowercase: Turkish `I` becomes `ı`, `İ` becomes `i`. */
export function lower(text: string, locale: Locale): string {
  return text.toLocaleLowerCase(localeTag(locale));
}

/** Uppercases the first letter only (`izmir` → `İzmir` in Turkish). */
export function capitalize(text: string, locale: Locale): string {
  const [first, ...rest] = [...text];
  return first === undefined ? '' : upper(first, locale) + rest.join('');
}

const collators = new Map<string, Intl.Collator>();

/** Cached collator: Turkish sorts c < ç, ı < i, s < ş; numbers sort naturally (2 < 10). */
export function collator(locale: Locale): Intl.Collator {
  const tag = localeTag(locale);
  let found = collators.get(tag);
  if (!found) {
    found = new Intl.Collator(tag, { numeric: true, sensitivity: 'base' });
    collators.set(tag, found);
  }
  return found;
}

export function compareText(a: string, b: string, locale: Locale): number {
  return collator(locale).compare(a, b);
}

export function sortText<T>(items: readonly T[], locale: Locale, key: (item: T) => string): T[] {
  const c = collator(locale);
  return [...items].sort((a, b) => c.compare(key(a), key(b)));
}

/**
 * Normalizes text for search so `ISTANBUL`, `İstanbul` and `istanbul` all match, and so do
 * `Çağlayan` and `caglayan`. Lowercasing with Turkish rules first maps both `I` and `İ` onto
 * i-like letters before accents are stripped.
 */
export function foldForSearch(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when every word of the query appears somewhere in the text (accent- and case-insensitive). */
export function matchesSearch(text: string, query: string): boolean {
  const haystack = foldForSearch(text);
  return foldForSearch(query)
    .split(' ')
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}
