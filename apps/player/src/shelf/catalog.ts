import { readParsed, type KeyValueStore } from '@ie/core';
import { LOCALES } from '@ie/i18n';
import { samples } from '@ie/samples';
import { compileStory, StoryLoadError, type StoryTheme } from '@ie/story';
import { z } from 'zod';
import { readSave } from '../story/saves.ts';

/*
 * The novels on the bookshelf (ADR 0022): those published next to this Player build
 * (`novels/index.json`), those the reader added from a file, and, in a build without published
 * novels, the bundled sample and kit starters.
 */

export type BookSource = 'published' | 'added' | 'bundled';

export interface Book {
  readonly id: string;
  readonly title: Readonly<Partial<Record<'en' | 'tr', string>>>;
  readonly author?: string;
  readonly languages: readonly string[];
  readonly theme?: StoryTheme;
  readonly source: BookSource;
  /** The reader has an autosave: the shelf offers Continue. */
  readonly started: boolean;
  /** The raw project, validated again when opened. */
  readonly load: () => Promise<unknown>;
}

const indexSchema = z.object({
  novels: z.array(
    z.object({
      id: z.string(),
      file: z.string().regex(/^[\w.-]+\.json$/, 'a file next to the index'),
    }),
  ),
  /** Open the first novel straight away, without the shelf (a one-novel public build). */
  direct: z.boolean().optional(),
});

/** Just what the shelf shows; the full project is checked when the book is opened. */
const coverSchema = z.object({
  id: z.string(),
  title: z.object({ en: z.string().optional(), tr: z.string().optional() }),
  author: z.string().optional(),
  languages: z.array(z.enum(LOCALES)),
  theme: z.unknown().optional(),
});

export const addedKey = (id: string) => `novel:${id}`;
const ADDED_PREFIX = 'novel:';

function cover(raw: unknown): z.infer<typeof coverSchema> | null {
  const parsed = coverSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

/** The published novels listed beside this build, or null when there are none. */
async function published(): Promise<{ raws: unknown[]; direct: boolean } | null> {
  let index: z.infer<typeof indexSchema>;
  try {
    index = indexSchema.parse(await fetchJson('./novels/index.json'));
  } catch {
    return null; // no index: a development or private build
  }
  const raws = await Promise.all(
    index.novels.map((n) => fetchJson(`./novels/${n.file}`).catch(() => null)),
  );
  return { raws: raws.filter((r) => r !== null), direct: index.direct ?? false };
}

async function bundled(): Promise<unknown[]> {
  const { KITS, createFromKit } = await import('@ie/kits');
  return [
    samples.rainAlley,
    ...KITS.map((kit) =>
      createFromKit(kit, {
        id: `kit_${kit.id.replaceAll('-', '_')}`,
        title: kit.name,
        theme: kit.theme,
        languages: ['en', 'tr'],
      }),
    ),
  ];
}

async function added(store: KeyValueStore): Promise<unknown[]> {
  const keys = await store.keys(ADDED_PREFIX);
  const raws = await Promise.all(keys.map((k) => readParsed(store, k, z.unknown())));
  return raws.filter((r) => r !== undefined);
}

export interface Shelf {
  readonly books: readonly Book[];
  /** Open this book without showing the shelf. */
  readonly direct?: string;
}

/** Everything on the shelf, published first, then the reader's own, then the bundled ones. */
export async function loadShelf(store: KeyValueStore): Promise<Shelf> {
  const pub = await published();
  const groups: [BookSource, unknown[]][] = [
    ['published', pub?.raws ?? []],
    ['added', await added(store)],
    ['bundled', pub ? [] : await bundled()],
  ];
  const books: Book[] = [];
  const seen = new Set<string>();
  for (const [source, raws] of groups) {
    for (const raw of raws) {
      const c = cover(raw);
      if (!c || seen.has(c.id)) continue;
      seen.add(c.id);
      books.push({
        id: c.id,
        title: c.title,
        ...(c.author ? { author: c.author } : {}),
        languages: c.languages,
        ...(c.theme ? { theme: c.theme as StoryTheme } : {}),
        source,
        started: (await readSave(store, c.id, 'auto')) !== undefined,
        load: () => Promise.resolve(raw),
      });
    }
  }
  return { books, ...(pub?.direct && books[0] ? { direct: books[0].id } : {}) };
}

/** Checks a file the reader picked and keeps it on the shelf. Returns its id, or the problems. */
export async function addNovel(store: KeyValueStore, text: string): Promise<string | string[]> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return ['not-json'];
  }
  try {
    const story = compileStory(raw);
    await store.set(addedKey(story.project.id), raw);
    return story.project.id;
  } catch (error) {
    if (error instanceof StoryLoadError) return error.problems.map((p) => p.message);
    throw error;
  }
}

export async function removeNovel(store: KeyValueStore, id: string): Promise<void> {
  await store.delete(addedKey(id));
}
