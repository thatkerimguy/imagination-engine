import { createServiceKey, defineAction, defineModule, type EngineModule } from '@ie/core';
import { imageSetSchema, videoSetSchema } from '@ie/story';
import type { MediaLayer } from './layer.ts';

export const MEDIA_LAYER = createServiceKey<MediaLayer>('media.layer');

/** The optional media module: pictures and muted video behind the text (ADR 0026). */
export function createMediaModule(layer: MediaLayer): EngineModule {
  return defineModule({
    id: 'media',
    install(ctx) {
      const { actions, services } = ctx;
      ctx.onDispose(services.provide(MEDIA_LAYER, layer));
      actions.register(
        defineAction({
          id: 'media.image.set',
          description: 'Show a picture behind the text, or take it away.',
          params: imageSetSchema,
          run: (p) => layer.imageSet(p),
        }),
      );
      actions.register(
        defineAction({
          id: 'media.video.set',
          description: 'Play a muted video behind the text, or stop it.',
          params: videoSetSchema,
          run: (p) => layer.videoSet(p),
        }),
      );
    },
  });
}
