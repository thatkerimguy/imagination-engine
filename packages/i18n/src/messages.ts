import { localeTag, type Locale } from './locales.ts';

/**
 * A message catalog in both languages. The Turkish table must have exactly the English keys, so a
 * missing translation is a type error rather than a blank label.
 */
export interface Catalogs<K extends string> {
  readonly en: Readonly<Record<K, string>>;
  readonly tr: Readonly<Record<K, string>>;
}

export function defineCatalogs<const E extends Record<string, string>>(catalogs: {
  en: E;
  tr: Record<keyof E, string>;
}): Catalogs<keyof E & string> {
  return catalogs;
}

export type MessageParams = Readonly<Record<string, string | number>>;

const numberFormats = new Map<string, Intl.NumberFormat>();

function formatNumber(value: number, locale: Locale): string {
  const tag = localeTag(locale);
  let format = numberFormats.get(tag);
  if (!format) {
    format = new Intl.NumberFormat(tag);
    numberFormats.set(tag, format);
  }
  return format.format(value);
}

/** Replaces `{name}` placeholders. Numbers use the locale's digit grouping; unknown names stay visible. */
export function formatMessage(template: string, params: MessageParams, locale: Locale): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined) return match;
    return typeof value === 'number' ? formatNumber(value, locale) : value;
  });
}

export interface Translator<K extends string> {
  (key: K, params?: MessageParams): string;
  readonly locale: Locale;
}

export function createTranslator<K extends string>(
  catalogs: Catalogs<K>,
  locale: Locale,
): Translator<K> {
  const table = catalogs[locale];
  const translate = (key: K, params?: MessageParams) => {
    const template = table[key];
    return params ? formatMessage(template, params, locale) : template;
  };
  return Object.assign(translate, { locale });
}

/** CLDR plural category for a count (`one`, `other`, ...). Turkish nouns after numbers stay singular. */
export function pluralCategory(locale: Locale, count: number): Intl.LDMLPluralRule {
  return new Intl.PluralRules(localeTag(locale)).select(count);
}
