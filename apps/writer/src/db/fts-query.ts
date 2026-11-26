// One tokenizer + query grammar for both search engines, matching FTS5's
// `unicode61 remove_diacritics 2`: case-folded, accents stripped, split on non letters/digits.
// Query: bare words are token prefixes (`tid` → "tide"); "double quoted" text is an exact phrase.
// Every word / phrase must match (AND). Pure.

const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function tokenize(s: string): string[] {
  return fold(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export interface ParsedQuery {
  /** Single tokens, each matched as a prefix. */
  prefixes: string[];
  /** Multi-token phrases, matched as consecutive tokens. */
  phrases: string[][];
}

export function parseQuery(query: string): ParsedQuery {
  const prefixes: string[] = [];
  const phrases: string[][] = [];
  const re = /"([^"]*)"?|([^\s"]+)/g;
  for (let m = re.exec(query); m; m = re.exec(query)) {
    const tokens = tokenize(m[1] ?? m[2] ?? '');
    if (m[1] !== undefined && tokens.length > 1) phrases.push(tokens);
    else prefixes.push(...tokens);
  }
  return { prefixes: [...new Set(prefixes)], phrases };
}

export const isEmptyQuery = (q: ParsedQuery): boolean =>
  q.prefixes.length === 0 && q.phrases.length === 0;

/** The FTS5 MATCH expression for a parsed query (tokens are [\p{L}\p{N}]+, so quoting is safe). */
export function toFtsMatch(q: ParsedQuery): string {
  return [...q.prefixes.map((t) => `"${t}"*`), ...q.phrases.map((p) => `"${p.join(' ')}"`)].join(
    ' ',
  );
}
