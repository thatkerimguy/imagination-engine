import { createServiceKey, defineAction, defineModule, type EngineModule } from '@ie/core';
import {
  backgroundSetSchema,
  burstSchema,
  flashSchema,
  hitStopSchema,
  lookSetSchema,
  shakeSchema,
  titleSchema,
  transitionSchema,
} from '@ie/story';
import type { StageDirector } from './director.ts';

export const STAGE_DIRECTOR = createServiceKey<StageDirector>('stage.director');

/** The stage module: story blocks and rules reach the GPU stage through these actions. */
export function createStageModule(director: StageDirector): EngineModule {
  return defineModule({
    id: 'stage',
    install(ctx) {
      const { actions, services } = ctx;
      ctx.onDispose(services.provide(STAGE_DIRECTOR, director));
      actions.register(
        defineAction({
          id: 'stage.background.set',
          description: 'Set the moving background: rain, embers, stars, snow, or none.',
          params: backgroundSetSchema,
          run: (p) => director.backgroundSet(p),
        }),
      );
      actions.register(
        defineAction({
          id: 'stage.look.set',
          description: 'Set the look over the whole screen: film, CRT, noir, dream, or none.',
          params: lookSetSchema,
          run: (p) => director.lookSet(p),
        }),
      );
      actions.register(
        defineAction({
          id: 'stage.shake',
          description: 'Shake the screen.',
          params: shakeSchema,
          run: (p) => director.shake(p.strength),
        }),
      );
      actions.register(
        defineAction({
          id: 'stage.flash',
          description: 'Flash the screen (at most twice a second).',
          params: flashSchema,
          run: (p) => director.flash(p),
        }),
      );
      actions.register(
        defineAction({
          id: 'stage.hitstop',
          description: 'Freeze the stage for a moment.',
          params: hitStopSchema,
          run: (p) => director.hitStop(p.seconds),
        }),
      );
      actions.register(
        defineAction({
          id: 'stage.burst',
          description: 'Throw a burst of glyph particles.',
          params: burstSchema,
          run: (p) => director.burst(p),
        }),
      );
      actions.register(
        defineAction({
          id: 'stage.title',
          description: 'Show large text on the stage.',
          params: titleSchema,
          run: (p) => director.title(p),
        }),
      );
      actions.register(
        defineAction({
          id: 'stage.transition',
          description: 'Cover and uncover the screen.',
          params: transitionSchema,
          run: (p) => director.transition(p),
        }),
      );
      ctx.onDispose(() => director.dispose());
    },
  });
}
