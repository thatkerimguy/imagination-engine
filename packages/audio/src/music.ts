import type { MusicSet, Track } from '@ie/story';
import type { ClockSource } from './conductor.ts';
import type { AudioEngine } from './engine.ts';

/** Turns a track into a playable URL: an object URL for a stored file, or the stream URL. */
export type TrackResolver = (track: Track) => Promise<string | null>;

interface Playing {
  readonly trackId: string;
  readonly element: HTMLAudioElement;
  /** Present when the element is routed through the mixer (same-origin or CORS-enabled). */
  readonly gain: GainNode | null;
  volume: number;
  release?: () => void;
}

const DEFAULT_FADE = 1.5;
const STEP_MS = 50;

/**
 * Background music: one track at a time, crossfaded. Tracks stream through media elements, so a
 * long song never sits decoded in memory. Elements are routed through the mixer when the server
 * allows it; otherwise their own volume follows the music bus, without the muffle effect.
 */
export class MusicPlayer {
  private playing: Playing | null = null;
  private generation = 0;
  private readonly stopVolumeWatch: () => void;

  constructor(
    private readonly engine: AudioEngine,
    private readonly resolve: TrackResolver,
  ) {
    this.stopVolumeWatch = engine.onVolume(() => {
      const p = this.playing;
      if (p && !p.gain) p.element.volume = this.elementVolume(p.volume);
    });
  }

  get trackId(): string | null {
    return this.playing?.trackId ?? null;
  }

  /** The playing track's clock, for a Conductor. */
  readonly clock: ClockSource = clockOf(() => this.playing?.element ?? null);

  /** Applies an `audio.music.set` action. */
  async set(params: MusicSet, track: Track | undefined): Promise<void> {
    const fade = params.fade ?? DEFAULT_FADE;
    const volume = params.volume ?? 1;
    const current = this.playing;
    if (current && params.track === current.trackId) {
      this.fadeTo(current, volume, fade);
      current.element.loop = params.loop ?? true;
      // Still paused if autoplay blocked it before the first tap.
      if (current.element.paused) current.element.play().catch(() => {});
      return;
    }
    const generation = ++this.generation;
    if (current) this.fadeOut(current, fade);
    this.playing = null;
    if (!params.track || !track) return;
    const url = await this.resolve(track);
    if (!url || generation !== this.generation) return;
    const next = await this.open(track.id, url);
    if (generation !== this.generation) {
      next.element.pause();
      next.release?.();
      return;
    }
    next.element.loop = params.loop ?? true;
    this.playing = next;
    this.setLevel(next, 0);
    try {
      await next.element.play();
    } catch {
      // Autoplay is blocked until the first tap; the engine resumes then.
    }
    this.fadeTo(next, volume, fade);
  }

  /** Jumps within the playing track (the Studio's beat check). */
  seek(seconds: number): void {
    if (this.playing) this.playing.element.currentTime = Math.max(0, seconds);
  }

  stop(fade = 0): void {
    this.generation++;
    if (this.playing) this.fadeOut(this.playing, fade);
    this.playing = null;
  }

  dispose(): void {
    this.stop(0);
    this.stopVolumeWatch();
  }

  private async open(trackId: string, url: string): Promise<Playing> {
    const routed = await loadElement(url, true);
    const element = routed ?? (await loadElement(url, false)) ?? new Audio(url);
    let gain: GainNode | null = null;
    if (routed) {
      const ctx = this.engine.context;
      gain = ctx.createGain();
      ctx.createMediaElementSource(element).connect(gain).connect(this.engine.input('music'));
    }
    const playing: Playing = { trackId, element, gain, volume: 0 };
    if (url.startsWith('blob:')) playing.release = () => URL.revokeObjectURL(url);
    return playing;
  }

  private elementVolume(volume: number): number {
    return Math.max(0, Math.min(1, volume * this.engine.level('music')));
  }

  private setLevel(p: Playing, volume: number): void {
    p.volume = volume;
    if (p.gain) p.gain.gain.value = volume;
    else p.element.volume = this.elementVolume(volume);
  }

  private fadeTo(p: Playing, volume: number, seconds: number): void {
    if (p.gain) {
      const now = this.engine.context.currentTime;
      p.gain.gain.cancelScheduledValues(now);
      p.gain.gain.setValueAtTime(p.gain.gain.value, now);
      p.gain.gain.linearRampToValueAtTime(volume, now + Math.max(0.01, seconds));
      p.volume = volume;
      return;
    }
    // Element volume can't be automated: step it, only while a fade runs.
    const from = p.volume;
    const steps = Math.max(1, Math.round((seconds * 1000) / STEP_MS));
    let i = 0;
    const timer = setInterval(() => {
      i++;
      this.setLevel(p, from + ((volume - from) * i) / steps);
      if (i >= steps) clearInterval(timer);
    }, STEP_MS);
  }

  private fadeOut(p: Playing, seconds: number): void {
    this.fadeTo(p, 0, seconds);
    setTimeout(
      () => {
        p.element.pause();
        p.element.removeAttribute('src');
        p.element.load();
        p.gain?.disconnect();
        p.release?.();
      },
      seconds * 1000 + 100,
    );
  }
}

/** A media element's playback as a coarse clock (the conductor smooths it). */
export function clockOf(element: () => HTMLMediaElement | null): ClockSource {
  return {
    position: () => element()?.currentTime ?? 0,
    get playing() {
      const e = element();
      return e !== null && !e.paused;
    },
    exact: false,
  };
}

/** Resolves with a loaded element, or null if it can't load (e.g. no CORS when `cors` is set). */
function loadElement(url: string, cors: boolean): Promise<HTMLAudioElement | null> {
  return new Promise((resolve) => {
    const element = new Audio();
    if (cors) element.crossOrigin = 'anonymous';
    element.preload = 'auto';
    const done = (ok: boolean) => {
      element.oncanplay = null;
      element.onerror = null;
      resolve(ok ? element : null);
    };
    element.oncanplay = () => done(true);
    element.onerror = () => done(false);
    element.src = url;
  });
}
