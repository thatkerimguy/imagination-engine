import type { ClockSource } from './conductor.ts';
import type { AudioEngine } from './engine.ts';
import { TempoMap } from './tempo.ts';

const RATE = 22050;
/** How far ahead hits are scheduled, and how often the scheduler wakes. */
const LOOKAHEAD = 0.12;
const WAKE_MS = 25;

/** Drum voices rendered once into buffers, so each hit is one buffer source. */
export function renderDrums(): Record<'kick' | 'snare' | 'hat' | 'bass', Float32Array> {
  const make = (seconds: number, fn: (t: number, i: number) => number) => {
    const out = new Float32Array(Math.round(RATE * seconds));
    for (let i = 0; i < out.length; i++) out[i] = fn(i / RATE, i);
    return out;
  };
  let seed = 1;
  const noise = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  };
  let hatLast = 0;
  return {
    // A sine that falls from 150 to 45 Hz: the thump of a kick drum.
    kick: make(0.35, (t) => {
      const phase = 2 * Math.PI * (45 * t + (105 / 18) * (1 - Math.exp(-18 * t)));
      return Math.sin(phase) * Math.exp(-7 * t) * 0.9;
    }),
    snare: make(
      0.2,
      (t) => (noise() * 0.7 + Math.sin(2 * Math.PI * 190 * t) * 0.3) * Math.exp(-22 * t) * 0.6,
    ),
    // Noise with its low end removed by a first-order high-pass.
    hat: make(0.05, () => {
      const n = noise();
      const out = n - hatLast;
      hatLast = n;
      return out * 0.25;
    }).map((v, i) => v * Math.exp(-i / (RATE * 0.012))),
    bass: make(
      0.3,
      (t) => Math.sin(2 * Math.PI * 55 * t) * Math.min(1, t * 200) * Math.exp(-5 * t) * 0.5,
    ),
  };
}

/**
 * A drum loop made on the spot, for fights with no song (ADR 0016). Its clock is the audio
 * clock itself, so it is exact. Intensity adds layers: kick and snare, then eighth hats, then
 * sixteenth hats and a bass pulse.
 */
export class ProceduralBeat implements ClockSource {
  readonly exact = true;
  readonly tempo: TempoMap;
  private buffers: Record<string, AudioBuffer> | null = null;
  private startAt = 0;
  private nextStep = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private intensity = 0;
  private readonly out: GainNode;

  constructor(
    private readonly engine: AudioEngine,
    readonly bpm = 100,
    readonly beatsPerBar = 4,
  ) {
    this.tempo = TempoMap.constant(bpm, 0, beatsPerBar);
    this.out = engine.context.createGain();
    this.out.connect(engine.input('music'));
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  /** Seconds since the loop's first downbeat (negative during the short lead-in). */
  position(): number {
    return this.timer === null ? 0 : this.engine.context.currentTime - this.startAt;
  }

  /** 0 plays kick and snare; more adds hats and bass. */
  setIntensity(value: number): void {
    this.intensity = Math.max(0, Math.min(1, value));
  }

  start(): void {
    if (this.timer) return;
    if (!this.buffers) {
      const drums = renderDrums();
      this.buffers = Object.fromEntries(
        Object.entries(drums).map(([k, v]) => [k, this.engine.buffer(v, RATE)]),
      );
    }
    this.startAt = this.engine.context.currentTime + 0.1;
    this.nextStep = 0;
    this.out.gain.value = 1;
    this.timer = setInterval(() => this.schedule(), WAKE_MS);
    this.schedule();
  }

  stop(fade = 0.3): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    const now = this.engine.context.currentTime;
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0, now + Math.max(0.02, fade));
  }

  dispose(): void {
    this.stop(0);
    this.out.disconnect();
  }

  private schedule(): void {
    const ctx = this.engine.context;
    const step = 60 / this.bpm / 4; // sixteenths
    const stepsPerBar = this.beatsPerBar * 4;
    while (this.startAt + this.nextStep * step < ctx.currentTime + LOOKAHEAD) {
      const at = this.startAt + this.nextStep * step;
      const s = this.nextStep % stepsPerBar;
      if (at >= ctx.currentTime - 0.01) {
        const onBeat = s % 4 === 0;
        const beat = s / 4;
        if (s === 0 || (onBeat && beat === 2) || s === 10) this.hit('kick', at, 1);
        if (onBeat && beat % 2 === 1) this.hit('snare', at, 0.8);
        if (this.intensity >= 0.35 && s % 2 === 0) this.hit('hat', at, onBeat ? 0.7 : 0.45);
        if (this.intensity >= 0.7 && s % 2 === 1) this.hit('hat', at, 0.3);
        if (this.intensity >= 0.7 && (s === 0 || s === 6 || s === 8)) this.hit('bass', at, 0.8);
      }
      this.nextStep++;
    }
  }

  private hit(name: string, at: number, volume: number): void {
    const buffer = this.buffers?.[name];
    if (!buffer) return;
    const ctx = this.engine.context;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(this.out);
    source.start(at);
    source.onended = () => gain.disconnect();
  }
}
