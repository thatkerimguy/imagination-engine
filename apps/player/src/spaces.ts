import type { Locale } from '@ie/i18n';
import { SpaceDeck, type ScreenHost } from '@ie/present';
import type { CompiledStory } from '@ie/story';
import type { StoryController } from './story/controller.ts';

interface SpacesInput {
  readonly story: CompiledStory;
  readonly reader: HTMLElement;
  readonly screens: ScreenHost;
  readonly controller: StoryController;
  readonly locale: Locale;
  /** False while a menu, fight or minigame owns the reader's fingers. */
  readonly canMove: () => boolean;
  readonly go: (roomId: string) => void;
  readonly moved: () => void;
}

/**
 * The spaces beside the story (ADR 0031), when the novel has any: the reader becomes the middle
 * pane, and the deck takes its place between the HUD strips. Null for a novel without spaces.
 */
export function mountSpaces(input: SpacesInput): SpaceDeck | null {
  const sides = input.story.project.spaces ?? [];
  if (sides.length === 0) return null;
  const { screens } = input;
  const deck = new SpaceDeck(
    input.reader,
    sides,
    {
      go: input.go,
      screen: (element, screenId) => screens.showIn(element, screenId),
      canMove: () => input.canMove() && !screens.covering,
      moved: input.moved,
    },
    input.locale,
  );
  screens.hudBottom.before(deck.element);
  input.controller.useSpaces(deck);
  return deck;
}
