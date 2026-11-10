import type { StoryRuntime } from '@ie/story';

/** What the Player needs from a fight or minigame runner. */
export interface Runner<B> {
  readonly running: boolean;
  start(runtime: StoryRuntime, beat: B): void;
  sync(runtime: StoryRuntime): void;
  stop(): void;
}

/**
 * Loads a runner's package the first time the story needs it (§11.1 budget, ADR 0022): most
 * pages never fight or play a minigame, so the reader doesn't download that code up front.
 * While it loads, it counts as running, so taps and keys don't move the story past the beat.
 */
export class LazyRunner<B> implements Runner<B> {
  private instance: Runner<B> | null = null;
  private loading: Promise<Runner<B>> | null = null;
  private wanted: { runtime: StoryRuntime; beat: B; length: number } | null = null;

  constructor(private readonly load: () => Promise<Runner<B>>) {}

  get running(): boolean {
    return this.instance?.running ?? this.wanted !== null;
  }

  start(runtime: StoryRuntime, beat: B): void {
    if (this.instance) {
      this.instance.start(runtime, beat);
      return;
    }
    this.wanted = { runtime, beat, length: runtime.log.length };
    this.loading ??= this.load();
    this.loading.then(
      (runner) => {
        this.instance = runner;
        const wanted = this.wanted;
        this.wanted = null;
        // A rewind or load while the code was on its way: the story no longer waits here.
        if (wanted && wanted.runtime.log.length === wanted.length)
          runner.start(wanted.runtime, wanted.beat);
      },
      (error: unknown) => {
        this.loading = null;
        this.wanted = null;
        console.error(error);
      },
    );
  }

  sync(runtime: StoryRuntime): void {
    if (this.instance) this.instance.sync(runtime);
    else if (this.wanted && runtime.log.length !== this.wanted.length) this.wanted = null;
  }

  stop(): void {
    this.wanted = null;
    this.instance?.stop();
  }
}
