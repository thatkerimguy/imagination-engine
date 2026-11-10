import { defineAction, defineModule, type EngineModule } from '@ie/core';
import { fightResultSchema, type FightResult } from '@ie/story';
import { z } from 'zod';
import type { SlotId } from './saves.ts';

declare module '@ie/core' {
  interface EngineEvents {
    'story.passageEntered': { passageId: string };
    'story.choiceMade': { optionId: string };
    'story.ended': { endingId: string | null };
  }
}

export interface StoryActionsHost {
  advance(): void;
  choose(optionId: string): void;
  submit(answer: string): void;
  fight(result: FightResult): void;
  back(): void;
  rewind(to: number): void;
  restart(): void;
  save(slot: Exclude<SlotId, 'auto'>): Promise<void>;
  load(slot: SlotId): Promise<void>;
}

const manualSlot = z.union([z.literal(1), z.literal(2), z.literal(3)]);
/** Actions that take nothing still validate what they're given. */
const none = z.object({}).optional();

/**
 * Reader actions on the story. Taps, keys, timers and panels all go through these, so a rule,
 * a test or the Studio's Play view can drive the reader the same way.
 */
export function createStoryModule(host: () => StoryActionsHost | null): EngineModule {
  const call = <T>(use: (story: StoryActionsHost) => T): T | undefined => {
    const story = host();
    return story ? use(story) : undefined;
  };
  return defineModule({
    id: 'player.story',
    install({ actions }) {
      actions.register(
        defineAction({
          id: 'story.advance',
          params: none,
          description: 'Show the next line.',
          run: () => call((s) => s.advance()),
        }),
      );
      actions.register(
        defineAction({
          id: 'story.choose',
          description: 'Pick one of the options on screen.',
          params: z.object({ optionId: z.string().min(1) }),
          run: ({ optionId }) => call((s) => s.choose(optionId)),
        }),
      );
      actions.register(
        defineAction({
          id: 'story.submit',
          description: 'Answer the question on screen.',
          params: z.object({ answer: z.string().max(200) }),
          run: ({ answer }) => call((s) => s.submit(answer)),
        }),
      );
      actions.register(
        defineAction({
          id: 'story.fight',
          description: 'End the fight on screen with a result.',
          params: fightResultSchema,
          run: (result) => call((s) => s.fight(result)),
        }),
      );
      actions.register(
        defineAction({
          id: 'story.back',
          params: none,
          description: 'Step back one line or choice.',
          run: () => call((s) => s.back()),
        }),
      );
      actions.register(
        defineAction({
          id: 'story.rewind',
          description: 'Go back to an earlier choice.',
          params: z.object({ to: z.number().int().min(0) }),
          run: ({ to }) => call((s) => s.rewind(to)),
        }),
      );
      actions.register(
        defineAction({
          id: 'story.restart',
          params: none,
          description: 'Start the story over.',
          run: () => call((s) => s.restart()),
        }),
      );
      actions.register(
        defineAction({
          id: 'story.save',
          params: z.object({ slot: manualSlot }),
          run: ({ slot }) => call((s) => s.save(slot)),
        }),
      );
      actions.register(
        defineAction({
          id: 'story.load',
          params: z.object({ slot: z.union([z.literal('auto'), manualSlot]) }),
          run: ({ slot }) => call((s) => s.load(slot)),
        }),
      );
    },
  });
}
