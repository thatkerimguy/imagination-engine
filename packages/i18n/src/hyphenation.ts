import hyphenopoly from 'hyphenopoly';
import enPatterns from 'hyphenopoly/patterns/en-us.wasm?url';
import trPatterns from 'hyphenopoly/patterns/tr.wasm?url';
import { LOCALES, type Locale } from './locales.ts';

/** Inserts soft hyphens (U+00AD) at the break points of every word long enough to need one. */
export type Hyphenate = (text: string) => string;

/** Reads a pattern file; given the file name and the URL the app was built with. */
export type PatternLoader = (file: string, url: string) => Promise<ArrayBuffer | Uint8Array>;

const PATTERNS: Readonly<Record<Locale, { readonly name: string; readonly url: string }>> = {
  en: { name: 'en-us', url: enPatterns },
  tr: { name: 'tr', url: trPatterns },
};

const fetchPatterns: PatternLoader = async (_file, url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Hyphenation patterns failed to load (${response.status}).`);
  return response.arrayBuffer();
};

let loading: Promise<Readonly<Record<Locale, Hyphenate>>> | null = null;

/**
 * Loads Hyphenopoly's patterns for both languages (about 24 kB of WASM, precached by the PWA).
 * Browser hyphenation is patchy for Turkish (PLAN §4), so the presenter inserts soft hyphens
 * itself. A failed load can be retried by calling again.
 */
export function loadHyphenators(
  load: PatternLoader = fetchPatterns,
): Promise<Readonly<Record<Locale, Hyphenate>>> {
  loading ??= (async () => {
    const urls = new Map(LOCALES.map((l) => [`${PATTERNS[l].name}.wasm`, PATTERNS[l].url]));
    const engines = hyphenopoly.config({
      require: LOCALES.map((l) => PATTERNS[l].name),
      hyphen: '\u00AD',
      minWordLength: 6,
      loader: (file) => load(file, urls.get(file) ?? file),
    });
    const entries = await Promise.all(
      LOCALES.map(async (locale) => {
        const engine = engines.get(PATTERNS[locale].name);
        if (!engine) throw new Error(`No hyphenation patterns for ${locale}.`);
        return [locale, await engine] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<Locale, Hyphenate>;
  })().catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}
