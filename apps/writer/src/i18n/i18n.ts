// Tiny dependency-free i18n: `t()` with {{param}} interpolation and English fallback, locale
// resolution from the writer setting + device locales, and safe Intl formatting.
import { en, type StringKey } from './strings-en.ts';
import { es } from './strings-es.ts';

export type Locale = 'en' | 'es';
export type LanguageSetting = 'system' | Locale;
export const LOCALES: readonly Locale[] = ['en', 'es'];
export const LANGUAGE_SETTINGS: readonly LanguageSetting[] = ['system', 'en', 'es'];

export type { StringKey };
export type TParams = Readonly<Record<string, string | number>>;
export type Translate = (key: StringKey, params?: TParams) => string;

const DICTS: Readonly<Record<Locale, Readonly<Partial<Record<StringKey, string>>>>> = { en, es };

/** Looks up `key` (English fallback) and fills `{{param}}` placeholders; unknown ones stay as-is. */
export function t(key: StringKey, params?: TParams, locale: Locale = 'en'): string {
  const raw = DICTS[locale]?.[key] ?? en[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, name: string) => {
    const v = params[name];
    return v === undefined ? whole : String(v);
  });
}

/** Binds `t` to a locale. */
export const translator =
  (locale: Locale): Translate =>
  (key, params) =>
    t(key, params, locale);

type DeviceLocale = string | { languageCode: string | null };

const languageOf = (l: DeviceLocale): string => {
  const raw = typeof l === 'string' ? l : (l.languageCode ?? '');
  return raw.split(/[-_]/)[0]?.toLowerCase() ?? '';
};

/** An explicit setting wins; 'system' picks the first device locale we ship, else English. */
export function resolveLocale(
  setting: LanguageSetting,
  deviceLocales: readonly DeviceLocale[],
): Locale {
  if (setting === 'en' || setting === 'es') return setting;
  for (const l of deviceLocales) {
    const lang = languageOf(l);
    if (lang === 'en' || lang === 'es') return lang;
  }
  return 'en';
}

const TAGS: Readonly<Record<Locale, string>> = { en: 'en-US', es: 'es-ES' };

/** Locale-grouped number (en 12,345 · es 12.345); plain digits if Intl is unavailable. */
export function formatNumber(n: number, locale: Locale = 'en'): string {
  try {
    return new Intl.NumberFormat(TAGS[locale]).format(n);
  } catch {
    return String(n);
  }
}

/** Medium date (e.g. "Mar 5, 2026" / "5 mar 2026") from an ISO string; the ISO day if Intl fails. */
export function formatDate(iso: string, locale: Locale = 'en'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(TAGS[locale], { dateStyle: 'medium' }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}
