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

/** The case bodies of a plural block starting just after `plural,`, and where the block ends. */
function pluralCases(
  template: string,
  from: number,
): { cases: Map<string, string>; end: number } | null {
  const cases = new Map<string, string>();
  let i = from;
  for (;;) {
    while (/\s/.test(template[i] ?? '')) i++;
    if (template[i] === '}') return { cases, end: i + 1 };
    const name = /^[=\w]+/.exec(template.slice(i))?.[0];
    if (!name) return null;
    i += name.length;
    while (/\s/.test(template[i] ?? '')) i++;
    if (template[i] !== '{') return null;
    let depth = 1;
    const start = i + 1;
    for (i = start; i < template.length && depth > 0; i++) {
      if (template[i] === '{') depth++;
      else if (template[i] === '}') depth--;
    }
    if (depth > 0) return null;
    cases.set(name, template.slice(start, i - 1));
  }
}

/**
 * Picks the plural case for `{count, plural, one {# line} other {# lines}}` (ICU style: `=0`
 * exact cases, then the CLDR category, then `other`). `#` is the count, grouped for the locale.
 */
function formatPlurals(template: string, params: MessageParams, locale: Locale): string {
  const head = /\{(\w+),\s*plural,/g;
  let out = '';
  let last = 0;
  for (let m = head.exec(template); m; m = head.exec(template)) {
    const parsed = pluralCases(template, m.index + m[0].length);
    const value = params[m[1] ?? ''];
    if (!parsed || typeof value !== 'number') continue;
    const body =
      parsed.cases.get(`=${value}`) ??
      parsed.cases.get(pluralCategory(locale, value)) ??
      parsed.cases.get('other') ??
      '';
    out += template.slice(last, m.index) + body.replaceAll('#', formatNumber(value, locale));
    last = parsed.end;
    head.lastIndex = parsed.end;
  }
  return out + template.slice(last);
}

/**
 * Replaces `{name}` placeholders and picks plural cases. Numbers use the locale's digit grouping;
 * unknown names stay visible.
 */
export function formatMessage(template: string, params: MessageParams, locale: Locale): string {
  return formatPlurals(template, params, locale).replace(/\{(\w+)\}/g, (match, name: string) => {
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
