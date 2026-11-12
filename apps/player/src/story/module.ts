import { defineAction, defineModule, type EngineModule } from '@ie/core';
import {
  BATTLE_ACTS,
  fightResultSchema,
  minigameResultSchema,
  rhythmResultSchema,
  type BattleAction,
  type FightResult,
  type MinigameResult,
  type RhythmResult,
} from '@ie/story';
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
  minigame(result: MinigameResult): void;
  rhythm(result: RhythmResult): void;
  buy(itemId: string): void;
  sell(itemId: string): void;
  leaveShop(): void;
  battle(action: BattleAction): void;
  go(roomId: string): void;
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
          id: 'story.minigame',
          description: 'End the minigame on screen with a result.',
          params: minigameResultSchema,
          run: (result) => call((s) => s.minigame(result)),
        }),
      );
      actions.register(
        defineAction({
          id: 'story.rhythm',
          description: 'End the beatmap on screen with a result.',
          params: rhythmResultSchema,
          run: (result) => call((s) => s.rhythm(result)),
        }),
      );
      const item = z.object({ itemId: z.string().min(1) });
      actions.register(
        defineAction({
          id: 'story.buy',
          description: 'Buy one of an item in the shop on screen.',
          params: item,
          run: ({ itemId }) => call((s) => s.buy(itemId)),
        }),
      );
      actions.register(
        defineAction({
          id: 'story.sell',
          description: 'Sell one of an item in the shop on screen.',
          params: item,
          run: ({ itemId }) => call((s) => s.sell(itemId)),
        }),
      );
      actions.register(
        defineAction({
          id: 'story.leaveShop',
          params: none,
          description: 'Leave the shop on screen.',
          run: () => call((s) => s.leaveShop()),
        }),
      );
      actions.register(
        defineAction({
          id: 'story.battle',
          description: 'Take a turn in the battle on screen: attack, a skill, an item or run.',
          params: z.object({ act: z.enum(BATTLE_ACTS), id: z.string().min(1).optional() }),
          run: ({ act, id }) => call((s) => s.battle(id === undefined ? { act } : { act, id })),
        }),
      );
      actions.register(
        defineAction({
          id: 'story.go',
          description: 'Walk to a room through an exit, or travel there on the map.',
          params: z.object({ roomId: z.string().min(1) }),
          run: ({ roomId }) => call((s) => s.go(roomId)),
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
