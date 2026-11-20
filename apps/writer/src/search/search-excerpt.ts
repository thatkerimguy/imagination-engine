// Excerpt + highlight-span helpers for search results (pure, no imports).
const WINDOW = 100;
const LEAD = 36;

export type Span = [number, number];

/** Merged `[start, end)` occurrences of every term inside normalized text. */
export function occurrences(norm: string, terms: readonly string[]): Span[] {
  const spans: Span[] = [];
  for (const t of terms)
    for (let i = norm.indexOf(t); i >= 0; i = norm.indexOf(t, i + 1)) spans.push([i, i + t.length]);
  spans.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: Span[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([s[0], s[1]]);
  }
  return merged;
}

/** ~100 chars around the first hit; highlights are re-based onto the trimmed excerpt. */
export function excerptOf(text: string, spans: Span[]): { excerpt: string; highlights: Span[] } {
  const first = spans[0]?.[0] ?? 0;
  const end = Math.min(text.length, Math.max(0, first - LEAD) + WINDOW);
  const start = Math.max(0, Math.min(first - LEAD, end - WINDOW));
  const pre = start > 0 ? '…' : '';
  const post = end < text.length ? '…' : '';
  const raw = text.slice(start, end);
  const trimmedLeft = raw.length - raw.trimStart().length;
  const shift = pre.length - start - trimmedLeft;
  const highlights: Span[] = [];
  for (const [a, b] of spans)
    if (b > start && a < end)
      highlights.push([Math.max(a, start + trimmedLeft) + shift, Math.min(b, end) + shift]);
  return { excerpt: pre + raw.trim() + post, highlights };
}
