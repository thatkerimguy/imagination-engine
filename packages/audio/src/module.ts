import { createServiceKey, defineAction, defineModule, type EngineModule } from '@ie/core';
import { ambienceSetSchema, musicSetSchema, sfxPlaySchema } from '@ie/story';
import { z } from 'zod';
import type { AudioDirector } from './director.ts';
import { BUSES } from './engine.ts';

export const AUDIO_DIRECTOR = createServiceKey<AudioDirector>('audio.director');

/**
 * The audio module: story blocks, rules and the debug console reach sound through these actions.
 * The host builds the director, because only it knows where track files live.
 */
export function createAudioModule(director: AudioDirector): EngineModule {
  return defineModule({
    id: 'audio',
    install(ctx) {
      const { actions, services } = ctx;
      ctx.onDispose(services.provide(AUDIO_DIRECTOR, director));
      actions.register(
        defineAction({
          id: 'audio.music.set',
          description: 'Play a track (crossfading from the current one), or stop the music.',
          params: musicSetSchema,
          run: (params) => director.musicSet(params),
        }),
      );
      actions.register(
        defineAction({
          id: 'audio.ambience.set',
          description: 'Fade an ambience layer (rain, wind, room, crowd, fire) to a volume.',
          params: ambienceSetSchema,
          run: (params) => director.ambienceSet(params),
        }),
      );
      actions.register(
        defineAction({
          id: 'audio.sfx.play',
          description: 'Play a sound effect from the novel.',
          params: sfxPlaySchema,
          run: (params) => director.sfxPlay(params),
        }),
      );
      actions.register(
        defineAction({
          id: 'audio.volume.set',
          description: 'Set the volume of a mixer bus, or of everything.',
          params: z.object({
            bus: z.enum([...BUSES, 'master']),
            volume: z.number().min(0).max(1),
          }),
          run: ({ bus, volume }) => director.engine.setVolume(bus, volume),
        }),
      );
      ctx.onDispose(() => director.dispose());
    },
  });
}
