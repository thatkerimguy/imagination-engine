import type { KeyValueStore } from '@ie/core';
import { StoryLoadError, compileStory, type CompiledStory } from '@ie/story';
import { loadShelf, type Shelf } from '../shelf/catalog.ts';

function compile(raw: unknown): CompiledStory | StoryLoadError {
  try {
    return compileStory(raw);
  } catch (error) {
    if (error instanceof StoryLoadError) return error;
    throw error;
  }
}

/** What the Player opens with: a story, a story that failed to load, or the bookshelf. */
export type Opening = CompiledStory | StoryLoadError | { readonly shelf: Shelf };

/** The page address of a novel, keeping other options (such as `?hud`). */
export function novelUrl(id: string | null, search: string = location.search): string {
  const params = new URLSearchParams(search);
  params.delete('kit');
  if (id) params.set('novel', id);
  else params.delete('novel');
  const query = params.toString();
  return query ? `./?${query}` : './';
}

/**
 * `?novel=<id>` opens that book from the shelf; without it the Player shows the shelf (ADR 0022).
 * During development, `?kit=chat` (or any kit id) plays that kit's starter story directly.
 */
export async function openStory(
  store: KeyValueStore,
  search: string = location.search,
): Promise<Opening> {
  const params = new URLSearchParams(search);
  const kitId = params.get('kit');
  if (import.meta.env.DEV && kitId) {
    const { createFromKit, findKit } = await import('@ie/kits');
    const kit = findKit(kitId);
    if (kit)
      return compile(
        createFromKit(kit, {
          id: `kit_${kitId.replaceAll('-', '_')}`,
          title: kit.name,
          theme: kit.theme,
          languages: ['en', 'tr'],
        }),
      );
  }
  const shelf = await loadShelf(store);
  const wanted = params.get('novel') ?? shelf.direct;
  const book = wanted ? shelf.books.find((b) => b.id === wanted) : undefined;
  return book ? compile(await book.load()) : { shelf };
}
