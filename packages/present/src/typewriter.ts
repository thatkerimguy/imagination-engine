/** One thing the typewriter reveals: a run of characters, all of a run at once, or a silence. */
export type RevealStep =
  | {
      readonly kind: 'chars';
      readonly text: string;
      /** Multiplier from the `[speed=…]` effect. */
      readonly speed: number;
      reveal(count: number): void;
    }
  | { readonly kind: 'whole'; readonly length: number; reveal(): void }
  | { readonly kind: 'pause'; readonly ms: number };

export interface Scheduler {
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export const timeoutScheduler: Scheduler = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Characters per second for each reading speed. */
export const TEXT_SPEEDS = ['slow', 'normal', 'fast', 'instant'] as const;
export type TextSpeed = (typeof TEXT_SPEEDS)[number];
export const CHARS_PER_SECOND: Readonly<Record<TextSpeed, number>> = {
  slow: 28,
  normal: 55,
  fast: 110,
  instant: Number.POSITIVE_INFINITY,
};

// Readers breathe at the end of a sentence and a little at commas.
const SENTENCE_STOP = /[.!?…]/;
const CLAUSE_STOP = /[,;:—–]/;
const SENTENCE_PAUSE_MS = 260;
const CLAUSE_PAUSE_MS = 110;
/** Timers can't usefully fire faster than a frame; reveal several characters per tick instead. */
const MIN_TICK_MS = 16;

/**
 * Reveals text over time. It knows nothing about the DOM: steps carry their own `reveal`
 * callbacks, so each tick costs two text-node writes at most, and the logic is unit-tested.
 */
export class Typewriter {
  private steps: readonly RevealStep[] = [];
  private index = 0;
  private shown = 0;
  private handle: unknown = null;
  private onDone: (() => void) | null = null;

  constructor(
    private cps: number,
    private readonly scheduler: Scheduler = timeoutScheduler,
  ) {}

  get busy(): boolean {
    return this.onDone !== null;
  }

  setSpeed(cps: number): void {
    this.cps = cps;
  }

  play(steps: readonly RevealStep[], onDone: () => void = () => {}): void {
    this.cancel();
    this.steps = steps;
    this.index = 0;
    this.shown = 0;
    this.onDone = onDone;
    if (!Number.isFinite(this.cps) || this.cps <= 0) this.skip();
    else this.tick();
  }

  /** Shows everything still hidden, now. */
  skip(): void {
    if (!this.onDone) return;
    for (let i = this.index; i < this.steps.length; i++) {
      const step = this.steps[i];
      if (step?.kind === 'chars') step.reveal(step.text.length);
      else if (step?.kind === 'whole') step.reveal();
    }
    this.finish();
  }

  /** Stops without revealing the rest (the text is being replaced anyway). */
  cancel(): void {
    if (this.handle !== null) this.scheduler.clear(this.handle);
    this.handle = null;
    this.onDone = null;
  }

  private finish(): void {
    const done = this.onDone;
    this.cancel();
    this.index = this.steps.length;
    done?.();
  }

  private schedule(ms: number): void {
    this.handle = this.scheduler.set(() => this.tick(), Math.max(0, ms));
  }

  private tick(): void {
    this.handle = null;
    const step = this.steps[this.index];
    if (!step) return this.finish();
    if (step.kind === 'pause') {
      this.index++;
      return this.schedule(step.ms);
    }
    const perChar = 1000 / this.cps;
    if (step.kind === 'whole') {
      step.reveal();
      this.index++;
      // The run appears at once, but reading it still takes time before the next one.
      return this.schedule(step.length * perChar * 0.5);
    }
    const charMs = perChar / step.speed;
    const batch = Math.max(1, Math.floor(MIN_TICK_MS / charMs));
    let extra = 0;
    for (let n = 0; n < batch && this.shown < step.text.length; n++) {
      this.shown++;
      extra = this.pauseAfter(step.text, this.shown) / step.speed;
      if (extra > 0) break;
    }
    step.reveal(this.shown);
    if (this.shown >= step.text.length) {
      this.index++;
      this.shown = 0;
    }
    this.schedule(charMs * batch + extra);
  }

  /** Extra time after the character just revealed: only at real stops, not "3.5" or "...". */
  private pauseAfter(text: string, shown: number): number {
    const char = text.charAt(shown - 1);
    const next = text.charAt(shown);
    if (next !== '' && !/\s/.test(next)) return 0;
    if (SENTENCE_STOP.test(char)) return SENTENCE_PAUSE_MS;
    if (CLAUSE_STOP.test(char)) return CLAUSE_PAUSE_MS;
    return 0;
  }
}
