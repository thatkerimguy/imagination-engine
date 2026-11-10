/** Mixer buses. Each has its own volume, set by the reader. */
export const BUSES = ['music', 'sfx', 'voice', 'ambience', 'ui'] as const;
export type Bus = (typeof BUSES)[number];

const RAMP = 0.05;

/**
 * The Web Audio graph: one context, a gain per bus into a master gain, and a muffle filter that
 * music and ambience pass through (behind a door, under water). The context is created on first
 * use and resumed on the first tap, since browsers start it suspended.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muffleFilter: BiquadFilterNode | null = null;
  private readonly gains = new Map<Bus, GainNode>();
  private readonly duckGain = new Map<Bus, GainNode>();
  private readonly volumes = new Map<Bus, number>(BUSES.map((b) => [b, 1]));
  private masterVolume = 1;
  private readonly volumeListeners = new Set<() => void>();

  get context(): AudioContext {
    if (!this.ctx) this.build();
    return this.ctx as AudioContext;
  }

  /** True once a context exists; nothing is created just to ask. */
  get started(): boolean {
    return this.ctx !== null;
  }

  /** Output latency the device reports, in seconds (0 if unknown). */
  get outputLatency(): number {
    const ctx = this.ctx;
    return ctx ? (ctx.outputLatency || 0) + (ctx.baseLatency || 0) : 0;
  }

  /** Resumes the context on the next tap or key press; browsers block audio until then. */
  unlockOnGesture(target: EventTarget = document, onUnlock?: () => void): () => void {
    let unlocked = false;
    const resume = () => {
      void this.resume().then(() => {
        // Media elements refused to play before this tap; the host restarts what should be playing.
        if (!unlocked) onUnlock?.();
        unlocked = true;
      });
    };
    const events = ['pointerdown', 'keydown', 'touchend'];
    for (const e of events) target.addEventListener(e, resume, { capture: true, passive: true });
    return () => {
      for (const e of events) target.removeEventListener(e, resume, { capture: true });
    };
  }

  async resume(): Promise<void> {
    if (this.context.state === 'suspended') await this.context.resume();
  }

  /** Where a sound for `bus` should connect. */
  input(bus: Bus): AudioNode {
    if (!this.ctx) this.build();
    const gain = this.duckGain.get(bus);
    if (!gain) throw new Error(`Unknown bus "${bus}".`);
    return gain;
  }

  setVolume(bus: Bus | 'master', volume: number): void {
    const v = Math.max(0, Math.min(1, volume));
    if (bus === 'master') this.masterVolume = v;
    else this.volumes.set(bus, v);
    for (const listener of this.volumeListeners) listener();
    if (!this.ctx) return;
    const node = bus === 'master' ? this.master : this.gains.get(bus);
    // Perceived loudness is roughly logarithmic; squaring the slider value feels even.
    node?.gain.setTargetAtTime(v * v, this.ctx.currentTime, RAMP);
  }

  /** Loudness factor of a bus including master, for sounds that can't go through the graph. */
  level(bus: Bus): number {
    return ((this.volumes.get(bus) ?? 1) * this.masterVolume) ** 2;
  }

  /** Called whenever a volume changes. */
  onVolume(listener: () => void): () => void {
    this.volumeListeners.add(listener);
    return () => this.volumeListeners.delete(listener);
  }

  /** Lowers a bus (e.g. music under a voice line) to `level` (0..1), or back to 1. */
  duck(bus: Bus, level: number, seconds = 0.3): void {
    const gain = this.duckGain.get(bus);
    if (!gain || !this.ctx) return;
    gain.gain.setTargetAtTime(level, this.ctx.currentTime, seconds / 3);
  }

  /** Muffles music and ambience, as if heard through a wall. */
  muffle(on: boolean, seconds = 0.6): void {
    if (!this.muffleFilter || !this.ctx) return;
    this.muffleFilter.frequency.setTargetAtTime(
      on ? 600 : 20000,
      this.ctx.currentTime,
      seconds / 3,
    );
  }

  /** Plays a buffer once on a bus. Returns a function that stops it. */
  play(buffer: AudioBuffer, bus: Bus, volume = 1, pan = 0): () => void {
    const ctx = this.context;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    let last: AudioNode = source.connect(gain);
    if (pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      last = last.connect(panner);
    }
    last.connect(this.input(bus));
    source.start();
    source.onended = () => gain.disconnect();
    return () => {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    };
  }

  /** Wraps mono samples in an AudioBuffer. */
  buffer(samples: Float32Array, sampleRate: number): AudioBuffer {
    const buffer = this.context.createBuffer(1, Math.max(1, samples.length), sampleRate);
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
    return buffer;
  }

  async close(): Promise<void> {
    const ctx = this.ctx;
    this.ctx = null;
    this.gains.clear();
    this.duckGain.clear();
    if (ctx) await ctx.close();
  }

  private build(): void {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.masterVolume ** 2;
    master.connect(ctx.destination);
    this.master = master;
    const muffle = ctx.createBiquadFilter();
    muffle.type = 'lowpass';
    muffle.frequency.value = 20000;
    muffle.connect(master);
    this.muffleFilter = muffle;
    for (const bus of BUSES) {
      const gain = ctx.createGain();
      gain.gain.value = (this.volumes.get(bus) ?? 1) ** 2;
      gain.connect(bus === 'music' || bus === 'ambience' ? muffle : master);
      const duck = ctx.createGain();
      duck.connect(gain);
      this.gains.set(bus, gain);
      this.duckGain.set(bus, duck);
    }
  }
}
