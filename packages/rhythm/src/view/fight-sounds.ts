import { generateSfxr, renderSfxr, SFXR_RATE, type AudioEngine } from '@ie/audio';
import { nextRandom } from '@ie/story';

type FightSound = 'strike' | 'parry' | 'hurt';

/** Seeded so every fight sounds the same; rendered once, then each hit is one buffer source. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    const next = nextRandom(state);
    state = next.state;
    return next.value;
  };
}

/** Strike, parry and hurt sounds made with sfxr the first time a fight needs them. */
export class FightSounds {
  private buffers: Partial<Record<FightSound, AudioBuffer>> = {};

  constructor(private readonly engine: AudioEngine) {}

  play(sound: FightSound): void {
    if (!this.engine.started) return;
    let buffer = this.buffers[sound];
    if (!buffer) {
      const random = seeded(sound === 'strike' ? 11 : sound === 'parry' ? 23 : 37);
      const preset = sound === 'strike' ? 'hit' : sound === 'parry' ? 'blip' : 'explosion';
      buffer = this.engine.buffer(renderSfxr(generateSfxr(preset, random), random), SFXR_RATE);
      this.buffers[sound] = buffer;
    }
    this.engine.play(buffer, 'sfx', sound === 'hurt' ? 0.5 : 0.7);
  }
}
