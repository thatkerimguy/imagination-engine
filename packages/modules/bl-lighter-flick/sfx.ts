// Procedural Zippo foley through the shared bus. Quiet by design; every node disconnects itself.
import type { AudioBusAccess } from '@kn/core/renderer';

let noise: { ctx: AudioContext; buffer: AudioBuffer } | null = null;

function noiseFor(ctx: AudioContext): AudioBuffer {
  if (noise?.ctx !== ctx) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.8), ctx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noise = { ctx, buffer };
  }
  return noise.buffer;
}

type Source = AudioScheduledSourceNode;

class Voice {
  readonly sources: Source[] = [];
  constructor(
    readonly ctx: AudioContext,
    readonly bus: GainNode,
  ) {}

  private env(at: number, peak: number, attack: number, end: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + end);
    g.connect(this.bus);
    return g;
  }

  /** A decaying sine partial. */
  tone(freq: number, at: number, level: number, decay: number, slideTo = freq): void {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(freq, at);
    if (slideTo !== freq) o.frequency.exponentialRampToValueAtTime(slideTo, at + decay);
    o.connect(this.env(at, level, 0.002, decay));
    o.start(at);
    o.stop(at + decay + 0.02);
    this.sources.push(o);
  }

  /** A filtered noise burst: `swell` is the attack time, `length` the full duration. */
  hiss(
    type: BiquadFilterType,
    freq: number,
    q: number,
    at: number,
    level: number,
    swell: number,
    length: number,
  ): void {
    const src = this.ctx.createBufferSource();
    src.buffer = noiseFor(this.ctx);
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f).connect(this.env(at, level, swell, length));
    src.start(at, Math.random() * 0.2, length + 0.02);
    this.sources.push(src);
  }
}

function play(
  audio: AudioBusAccess | null,
  build: (v: Voice, t0: number) => void,
  tail: number,
): () => void {
  const ctx = audio?.context;
  const out = audio?.sfx;
  if (!ctx || !out) return () => undefined;
  const bus = ctx.createGain();
  bus.gain.value = 0.5;
  bus.connect(out);
  const voice = new Voice(ctx, bus);
  build(voice, ctx.currentTime + 0.02);
  const done = setTimeout(() => bus.disconnect(), tail * 1000);
  return () => {
    clearTimeout(done);
    for (const s of voice.sources) {
      try {
        s.stop();
      } catch {
        // Already stopped.
      }
    }
    bus.disconnect();
  };
}

/** Lid clink, flint shhhk, soft whoomph. Returns a canceller. */
export function playIgnite(audio: AudioBusAccess | null): () => void {
  return play(
    audio,
    (v, t) => {
      for (const [hz, lvl] of [
        [2650, 0.3],
        [4180, 0.18],
        [6020, 0.1],
      ] as const)
        v.tone(hz, t, lvl, 0.28);
      v.hiss('bandpass', 3600, 1.2, t + 0.14, 0.32, 0.012, 0.16);
      v.hiss('lowpass', 520, 0.7, t + 0.3, 0.4, 0.22, 0.5);
    },
    1.2,
  );
}

/** Lid clack: a short low metallic thud plus a click. Returns a canceller. */
export function playClack(audio: AudioBusAccess | null): () => void {
  return play(
    audio,
    (v, t) => {
      v.tone(210, t, 0.5, 0.09, 110);
      v.tone(1900, t, 0.2, 0.12);
      v.hiss('bandpass', 4200, 2, t, 0.3, 0.002, 0.04);
    },
    0.6,
  );
}
