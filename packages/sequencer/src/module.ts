import { defineAction, defineModule, type EngineModule } from '@ie/core';
import type { StoryProject } from '@ie/story';
import { z } from 'zod';
import type { SequenceRunner } from './runner.ts';

/** `sequence.play` and `sequence.stop`: what a Sequence block that doesn't wait fires. */
export function createSequenceModule(
  runner: SequenceRunner,
  project: () => StoryProject | undefined,
): EngineModule {
  return defineModule({
    id: 'sequencer',
    install(ctx) {
      ctx.actions.register(
        defineAction({
          id: 'sequence.play',
          description: 'Play a sequence while the story goes on.',
          params: z.object({ sequence: z.string() }),
          run: ({ sequence }) => {
            const doc = project();
            if (doc) runner.play(doc, sequence);
          },
        }),
      );
      ctx.actions.register(
        defineAction({
          id: 'sequence.stop',
          description: 'Stop the sequence that is playing.',
          params: z.object({}),
          run: () => runner.stop(),
        }),
      );
      ctx.onDispose(() => runner.stop());
    },
  });
}
