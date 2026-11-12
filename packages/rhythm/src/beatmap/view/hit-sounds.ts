import type { AudioEngine } from '@ie/audio';

type Sound = 'hit' | 'tick' | 'break' | 'bar' | 'beat';

/** Short synthesized sounds: rendered once, then each one is a single buffer source. */
function render(sound: Sound, rate: number): Float32Array {
  const seconds = sound === 'break' ? 0.14 : sound === 'hit' ? 0.05 : 0.025;
  const out = new Float32Array(Math.round(seconds * rate));
  let noise = 12345;
  for (let i = 0; i < out.length; i++) {
    const t = i / rate;
    noise = (noise * 1103515245 + 12345) >>> 0;
    const white = (noise / 0xffffffff) * 2 - 1;
    switch (sound) {
      case 'hit':
        out[i] = (Math.sin(2 * Math.PI * 1900 * t) * 0.5 + white * 0.35) * Math.exp(-t * 90);
        break;
      case 'tick':
        out[i] = Math.sin(2 * Math.PI * 3200 * t) * 0.3 * Math.exp(-t * 220);
        break;
      case 'break': {
        const f = 220 - 900 * t;
        out[i] = Math.sin(2 * Math.PI * f * t) * 0.6 * Math.exp(-t * 18);
        break;
      }
      case 'bar':
        out[i] = Math.sin(2 * Math.PI * 1600 * t) * 0.5 * Math.exp(-t * 160);
        break;
      default:
        out[i] = Math.sin(2 * Math.PI * 1000 * t) * 0.35 * Math.exp(-t * 180);
    }
  }
  return out;
}

export class HitSounds {
  private readonly buffers = new Map<Sound, AudioBuffer>();
  volume = 0.8;

  constructor(private readonly engine: AudioEngine) {}

  private buffer(sound: Sound): AudioBuffer {
    let buffer = this.buffers.get(sound);
    if (!buffer) {
      const rate = this.engine.context.sampleRate;
      buffer = this.engine.buffer(render(sound, rate), rate);
      this.buffers.set(sound, buffer);
    }
    return buffer;
  }

  play(sound: 'hit' | 'tick' | 'break'): void {
    if (!this.engine.started || this.volume <= 0) return;
    this.engine.play(this.buffer(sound), 'sfx', this.volume * (sound === 'tick' ? 0.6 : 1));
  }

  /** A click-track beat at an exact context time. */
  click(bar: boolean, at: number): void {
    if (!this.engine.started) return;
    const ctx = this.engine.context;
    const source = ctx.createBufferSource();
    source.buffer = this.buffer(bar ? 'bar' : 'beat');
    source.connect(this.engine.input('music'));
    source.start(at);
    source.onended = () => source.disconnect();
  }
}
