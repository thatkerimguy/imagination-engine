import { timeoutScheduler, type Scheduler } from './typewriter.ts';

/** A one-shot timer that can be held (menu open) and survives redraws (language switch). */
export class Countdown {
  private handle: unknown = null;
  private startedAt = 0;
  private spent = 0;
  private running = false;
  private finished = false;

  constructor(
    readonly totalMs: number,
    private readonly onDone: () => void,
    private readonly now: () => number = () => performance.now(),
    private readonly scheduler: Scheduler = timeoutScheduler,
  ) {}

  /** Milliseconds already used. */
  get elapsed(): number {
    return Math.min(this.totalMs, this.spent + (this.running ? this.now() - this.startedAt : 0));
  }

  get paused(): boolean {
    return !this.running && !this.finished;
  }

  start(): void {
    if (this.running || this.finished) return;
    this.running = true;
    this.startedAt = this.now();
    this.handle = this.scheduler.set(() => {
      this.handle = null;
      this.running = false;
      this.finished = true;
      this.onDone();
    }, this.totalMs - this.spent);
  }

  pause(): void {
    if (!this.running) return;
    this.spent = this.elapsed;
    this.running = false;
    this.clear();
  }

  /** Continues after a hold, with the time that was left. */
  resume(): void {
    this.start();
  }

  cancel(): void {
    this.running = false;
    this.finished = true;
    this.clear();
  }

  private clear(): void {
    if (this.handle !== null) this.scheduler.clear(this.handle);
    this.handle = null;
  }
}
