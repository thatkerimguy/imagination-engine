import type { CompiledSequence, SequenceCue } from './compile.ts';
import { SequenceCursor } from './cursor.ts';

/** Runs an action the way a block would (through the app's action bus). */
export type Dispatch = (action: string, params: unknown) => void;

export interface FrameScheduler {
  request(callback: () => void): number;
  cancel(handle: number): void;
}

export interface SequencePlayerOptions {
  readonly sequence: CompiledSequence;
  /** The sequence beat heard now, or null while the music hasn't started yet. */
  readonly now: () => number | null;
  readonly dispatch: Dispatch;
  /** Every frame while playing, with the beat (the Studio's playhead). */
  readonly onFrame?: (beat: number) => void;
  /** It reached its end (not called by `stop`). */
  readonly onEnd?: () => void;
  /** Frame timing; `requestAnimationFrame` by default. */
  readonly frames?: FrameScheduler;
}

const browserFrames: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

/**
 * Plays a compiled sequence from animation frames, only while it plays. Each frame reads the clock
 * once and walks the cursor; cues go to `dispatch`.
 */
export class SequencePlayer {
  private readonly cursor: SequenceCursor;
  private readonly frames: FrameScheduler;
  private handle = 0;
  private running = false;
  private readonly fire: (cue: SequenceCue) => void;
  private readonly loop: () => void;

  constructor(private readonly options: SequencePlayerOptions) {
    this.cursor = new SequenceCursor(options.sequence.cues);
    this.frames = options.frames ?? browserFrames;
    // Bound once, so a frame allocates no closures.
    this.fire = (cue) => options.dispatch(cue.action, cue.params);
    this.loop = () => {
      if (!this.running) return;
      this.handle = this.frames.request(this.loop);
      this.tick();
    };
  }

  get playing(): boolean {
    return this.running;
  }

  /** Starts at `from` beats; cues before it don't fire. */
  start(from = 0): void {
    this.stop();
    this.cursor.seek(from);
    this.running = true;
    this.handle = this.frames.request(this.loop);
  }

  stop(): void {
    this.running = false;
    this.frames.cancel(this.handle);
  }

  /** One frame; public so tests can drive it without a browser. */
  tick(): void {
    const beat = this.options.now();
    if (beat === null) return;
    this.cursor.advance(beat, this.fire);
    this.options.onFrame?.(beat);
    if (beat >= this.options.sequence.length && this.cursor.done) {
      this.stop();
      this.options.onEnd?.();
    }
  }
}
