import { samples } from '@ie/samples';
import { StoryLoadError, compileStory, type CompiledStory } from '@ie/story';

function compile(raw: unknown): CompiledStory | StoryLoadError {
  try {
    return compileStory(raw);
  } catch (error) {
    if (error instanceof StoryLoadError) return error;
    throw error;
  }
}

/**
 * The bundled sample until the Studio can publish stories to the Player. During development,
 * `?kit=chat` (or any kit id) plays that kit's starter story instead, to try its screens and look.
 */
export async function loadStory(
  search: string = location.search,
): Promise<CompiledStory | StoryLoadError> {
  const kitId = new URLSearchParams(search).get('kit');
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
  return compile(samples.rainAlley);
}
