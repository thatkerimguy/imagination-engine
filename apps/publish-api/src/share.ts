// GET /share/<slug> (alias /r/<slug>): social-preview HTML with escaped Open Graph tags.
import type { HandlerConfig } from './config.ts';
import { fail } from './http.ts';
import { escapeHtml, htmlResponse, pageShell } from './html.ts';
import { isSlugId } from './protocol.ts';
import type { ObjectStore } from './store.ts';
import { TAKEN_DOWN_MESSAGE, isTakenDown, readNovelDoc } from './takedown.ts';

const WORDS_PER_MINUTE = 220;
const MAX_CHAPTER_READS = 60;

async function readJson(store: ObjectStore, key: string): Promise<Record<string, unknown> | null> {
  const obj = await store.get(key);
  if (!obj) return null;
  try {
    const v: unknown = JSON.parse(new TextDecoder().decode(obj.body));
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && isSlugId(x)) : [];

/** Minutes of prose across listed chapters (capped number of reads), at least 1. */
export async function estimateMinutes(
  store: ObjectStore,
  slug: string,
  novel: Record<string, unknown>,
): Promise<number> {
  let words = 0;
  let reads = 0;
  for (const seasonId of strings(novel.seasons)) {
    const season = await readJson(store, `novels/${slug}/seasons/${seasonId}/season.json`);
    for (const chapterId of strings(season?.chapters)) {
      if (reads++ >= MAX_CHAPTER_READS) break;
      const chapter = await readJson(store, `novels/${slug}/seasons/${seasonId}/${chapterId}.json`);
      const blocks = Array.isArray(chapter?.blocks) ? (chapter.blocks as unknown[]) : [];
      for (const block of blocks) {
        const b = block as { kind?: unknown; text?: unknown };
        if (b.kind === 'prose' && typeof b.text === 'string') {
          words += b.text.split(/\s+/).filter(Boolean).length;
        }
      }
    }
  }
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

function readerHref(readerUrl: string | undefined, slug: string): string | null {
  if (!readerUrl) return null;
  try {
    const u = new URL(readerUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return `${readerUrl.replace(/\/+$/, '')}/?novel=${encodeURIComponent(slug)}`;
  } catch {
    return null;
  }
}

export async function shareResponse(
  slug: string,
  request: Request,
  config: HandlerConfig,
): Promise<Response> {
  if (!isSlugId(slug)) return fail('Not found', 404);
  if (await isTakenDown(config.store, slug)) return fail(TAKEN_DOWN_MESSAGE, 410);
  const novel = await readNovelDoc(config.store, slug);
  if (!novel) return fail('Not found', 404);

  const title = typeof novel.title === 'string' && novel.title ? novel.title : 'Untitled';
  const subtitle = typeof novel.subtitle === 'string' ? novel.subtitle.trim() : '';
  const minutes = await estimateMinutes(config.store, slug, novel);
  const description = `${subtitle ? `${subtitle} · ` : ''}~${minutes} min read · Interactive Chapter`;
  const origin = new URL(request.url).origin;
  const image = `${origin}/og/${slug}.png`;
  const href = readerHref(config.readerUrl, slug);

  const meta = (attr: 'property' | 'name', name: string, value: string): string =>
    `<meta ${attr}="${name}" content="${escapeHtml(value)}">`;
  const head = [
    meta('property', 'og:title', title),
    meta('property', 'og:description', description),
    meta('property', 'og:image', image),
    meta('property', 'og:image:width', '1200'),
    meta('property', 'og:image:height', '630'),
    meta('property', 'og:type', 'book'),
    meta('property', 'og:url', `${origin}/share/${slug}`),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', title),
    meta('name', 'twitter:description', description),
    meta('name', 'twitter:image', image),
    href ? `<meta http-equiv="refresh" content="0; url=${escapeHtml(href)}">` : '',
  ].join('\n');

  const link = href
    ? `<p><a href="${escapeHtml(href)}">Open in the Imagination Engine reader</a></p>`
    : '<p>Open in the Imagination Engine reader</p>';
  const body = `<h1>${escapeHtml(title)}</h1>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}${link}`;
  return htmlResponse(pageShell({ title, body, head }));
}
