export const LOCALES = ['en', 'tr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export interface LocaleInfo {
  /** BCP 47 tag used for Intl APIs and `lang` attributes. */
  readonly tag: string;
  /** The language's name written in that language, for language pickers. */
  readonly nativeName: string;
}

export const LOCALE_INFO: Readonly<Record<Locale, LocaleInfo>> = {
  en: { tag: 'en-US', nativeName: 'English' },
  tr: { tag: 'tr-TR', nativeName: 'Türkçe' },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function localeTag(locale: Locale): string {
  return LOCALE_INFO[locale].tag;
}

/** Picks the first supported language from the browser's preference list. */
export function detectLocale(preferred: readonly string[] = browserLanguages()): Locale {
  for (const tag of preferred) {
    const primary = tag.toLowerCase().split('-')[0];
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages.length > 0 ? navigator.languages : [navigator.language];
}
