import type { AudioEngine } from '@ie/audio';
import type { TimingPoint } from '@ie/story';
import { gridLines } from '../timing.ts';
import type { HitSounds } from './hit-sounds.ts';

/** Where the song comes from: decoded audio (exact), a media element (smoothed), or none. */
export type SongSource =
  | { readonly kind: 'buffer'; readonly buffer: AudioBuffer }
  | { readonly kind: 'element'; readonly url: string }
  | { readonly kind: 'none' };

/** Decodes a song for exact timing; falls back to streaming it when it can't be read whole. */
export async function loadSong(engine: AudioEngine, url: string | null): Promise<SongSource> {
  if (!url) return { kind: 'none' };
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
    const buffer = await engine.context.decodeAudioData(await response.arrayBuffer());
    return { kind: 'buffer', buffer };
  } catch {
    // A cross-origin song without CORS can still play through an element.
    return { kind: 'element', url };
  }
}

const LOOKAHEAD = 0.12;
/** An element's reported position drifting further than this re-anchors the clock. */
const DRIFT_MS = 40;

/**
 * The beatmap's clock in song milliseconds, as heard. Decoded songs play from a buffer source,
 * so the clock is the audio clock itself. Without a song, a click track marks the beats so a
 * chart can be played and timed silently.
 */
export class SongClock {
  private source: AudioBufferSourceNode | null = null;
  private element: HTMLAudioElement | null = null;
  private readonly gain: GainNode;
  private anchorTime = 0;
  private anchorSong = 0;
  private running = false;
  private frozen = 0;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private clickedUntil = 0;
  private lastNow = Number.NEGATIVE_INFINITY;
  offset: number;

  constructor(
    private readonly engine: AudioEngine,
    private readonly song: SongSource,
    private readonly rate: number,
    private readonly timing: readonly TimingPoint[],
    private readonly sounds: HitSounds,
    options: { readonly offset: number },
  ) {
    this.offset = options.offset;
    this.gain = engine.context.createGain();
    this.gain.connect(engine.input('music'));
    if (song.kind === 'element') {
      const element = new Audio(song.url);
      element.preload = 'auto';
      element.preservesPitch = false;
      element.playbackRate = rate;
      this.element = element;
    }
  }

  get playing(): boolean {
    return this.running;
  }

  /** The song's length in ms, when known. */
  get duration(): number {
    if (this.song.kind === 'buffer') return this.song.buffer.duration * 1000;
    const d = this.element?.duration;
    return d && Number.isFinite(d) ? d * 1000 : 0;
  }

  /**
   * The context time of the sound reaching the speakers now. The output timestamp says so and is
   * smooth between render quanta; without it, the render clock less the output latency.
   */
  private heardNow(): number {
    const ctx = this.engine.context;
    const stamp = ctx.getOutputTimestamp?.();
    if (stamp?.contextTime && stamp.performanceTime)
      return stamp.contextTime + (performance.now() - stamp.performanceTime) / 1000;
    return ctx.currentTime - this.engine.outputLatency;
  }

  /** Song time heard now, in ms. Never runs backwards while playing. */
  now(): number {
    if (!this.running) return this.frozen;
    let t: number;
    if (this.element) {
      t = this.anchorSong + (performance.now() - this.anchorTime) * this.rate;
      const e = this.element;
      if (!e.paused && e.readyState >= 2) {
        const reported = e.currentTime * 1000;
        if (Math.abs(reported - t) > DRIFT_MS) {
          this.anchorSong = reported;
          this.anchorTime = performance.now();
          t = reported;
        }
      }
    } else {
      t = this.anchorSong + (this.heardNow() - this.anchorTime) * 1000 * this.rate;
    }
    t -= this.offset;
    if (t < this.lastNow && this.lastNow - t < DRIFT_MS) t = this.lastNow;
    this.lastNow = t;
    return t;
  }

  /** Starts from song time `from` (negative counts in before the song). */
  start(from: number): void {
    this.halt();
    const ctx = this.engine.context;
    const when = ctx.currentTime + 0.05;
    this.running = true;
    this.lastNow = Number.NEGATIVE_INFINITY;
    if (this.song.kind === 'buffer') {
      // The song's sample at `from` is scheduled for context time `when`.
      this.anchorTime = when;
      this.anchorSong = from;
      const source = ctx.createBufferSource();
      source.buffer = this.song.buffer;
      source.playbackRate.value = this.rate;
      source.connect(this.gain);
      if (from >= 0) {
        if (from / 1000 < this.song.buffer.duration) source.start(when, from / 1000);
      } else {
        source.start(when + -from / 1000 / this.rate, 0);
      }
      this.source = source;
    } else if (this.element) {
      const element = this.element;
      this.anchorTime = performance.now() + 50;
      this.anchorSong = from;
      element.currentTime = Math.max(0, from / 1000);
      const begin = () => {
        if (this.running && this.element === element) element.play().catch(() => undefined);
      };
      if (from >= 0) setTimeout(begin, 50);
      else setTimeout(begin, 50 + -from / this.rate);
    } else {
      this.anchorTime = when;
      this.anchorSong = from;
      this.clickedUntil = from - 1;
      this.ticker = setInterval(() => this.scheduleClicks(), 25);
      this.scheduleClicks();
    }
  }

  /** Freezes the clock where it is; `start(clock.now())` carries on. */
  pause(): void {
    this.frozen = this.now();
    this.halt();
  }

  setVolume(volume: number): void {
    this.gain.gain.value = volume;
  }

  dispose(): void {
    this.halt();
    this.gain.disconnect();
    if (this.element) {
      this.element.removeAttribute('src');
      this.element.load();
      this.element = null;
    }
  }

  private halt(): void {
    this.running = false;
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        // Never started (its start time hadn't come).
      }
      this.source.disconnect();
      this.source = null;
    }
    this.element?.pause();
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
  }

  /** Clicks on every beat a little ahead of time, louder on the bar. */
  private scheduleClicks(): void {
    if (!this.running) return;
    const ctx = this.engine.context;
    const song = (ctxTime: number) => this.anchorSong + (ctxTime - this.anchorTime) * 1000 * this.rate;
    const until = song(ctx.currentTime + LOOKAHEAD);
    if (until <= this.clickedUntil) return;
    for (const line of gridLines(this.timing, this.clickedUntil, until, 1, 64)) {
      if (line.t <= this.clickedUntil) continue;
      const at = this.anchorTime + (line.t - this.anchorSong) / 1000 / this.rate;
      if (at >= ctx.currentTime) this.sounds.click(line.strength === 'bar', at);
    }
    this.clickedUntil = until;
  }
}
