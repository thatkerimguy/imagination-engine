/**
 * Screen effects as plain numbers the renderer reads each frame: trauma shake, flash, hit-stop,
 * slow motion and zoom punch. Pure, so timing and the photosensitivity guard are unit-tested.
 */

/** At most this many flashes in any one second (WCAG 2.3.1 allows three; we stay under). */
export const MAX_FLASHES_PER_SECOND = 2;

export interface FxState {
  /** Camera offset in CSS pixels and rotation in radians, from shake. */
  readonly offsetX: number;
  readonly offsetY: number;
  readonly angle: number;
  /** Extra zoom, 0 = none. */
  readonly zoom: number;
  /** Flash colour and strength (0..1). */
  readonly flash: readonly [number, number, number];
  readonly flashAmount: number;
  /** How fast story time runs: 0 during hit-stop, below 1 in slow motion. */
  readonly timeScale: number;
}

export interface FxOptions {
  readonly reducedMotion?: boolean;
  /** Pixels of shake at full trauma. */
  readonly maxShake?: number;
}

/** Smooth noise in -1..1 from a few sines; enough for shake without a noise table. */
function wobble(t: number, seed: number): number {
  return (
    Math.sin(t * 37.1 + seed) * 0.5 +
    Math.sin(t * 61.7 + seed * 2.3) * 0.3 +
    Math.sin(t * 89.3 + seed * 4.1) * 0.2
  );
}

export class ScreenFx {
  private trauma = 0;
  private flashColor: [number, number, number] = [1, 1, 1];
  private flashLeft = 0;
  private flashLength = 0;
  private flashes: number[] = [];
  private stopLeft = 0;
  private slowLeft = 0;
  private slowScale = 1;
  private punch = 0;
  private time = 0;
  reducedMotion: boolean;
  private readonly maxShake: number;

  constructor(options: FxOptions = {}) {
    this.reducedMotion = options.reducedMotion ?? false;
    this.maxShake = options.maxShake ?? 24;
  }

  /** Adds trauma (0..1); shake grows with its square, so small hits stay small. */
  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + Math.max(0, amount));
  }

  /**
   * A flash, unless it would be the third within a second. Returns whether it shows. Under
   * reduced motion flashes are softer and longer rather than gone, since they can carry meaning.
   */
  flash(color: readonly [number, number, number] = [1, 1, 1], seconds = 0.18): boolean {
    this.flashes = this.flashes.filter((t) => this.time - t < 1);
    if (this.flashes.length >= MAX_FLASHES_PER_SECOND) return false;
    this.flashes.push(this.time);
    this.flashColor = [color[0], color[1], color[2]];
    this.flashLength = this.reducedMotion ? Math.max(seconds, 0.5) : seconds;
    this.flashLeft = this.flashLength;
    return true;
  }

  /** Freezes story time for a moment, the classic impact beat. */
  hitStop(seconds: number): void {
    this.stopLeft = Math.max(this.stopLeft, seconds);
  }

  slowMotion(scale: number, seconds: number): void {
    this.slowScale = Math.min(1, Math.max(0.05, scale));
    this.slowLeft = seconds;
  }

  zoomPunch(amount = 0.06): void {
    if (!this.reducedMotion) this.punch = Math.max(this.punch, amount);
  }

  /** True while anything still moves, so the stage can stop rendering when calm. */
  get active(): boolean {
    return (
      this.trauma > 0.001 ||
      this.flashLeft > 0 ||
      this.stopLeft > 0 ||
      this.slowLeft > 0 ||
      this.punch > 0.001
    );
  }

  /** Advances by real seconds and returns what to draw. */
  update(dt: number): FxState {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    this.flashLeft = Math.max(0, this.flashLeft - dt);
    this.stopLeft = Math.max(0, this.stopLeft - dt);
    this.slowLeft = Math.max(0, this.slowLeft - dt);
    this.punch *= Math.exp(-dt * 9);
    const shake = this.reducedMotion ? 0 : this.trauma * this.trauma;
    const fade = this.flashLength > 0 ? this.flashLeft / this.flashLength : 0;
    return {
      offsetX: wobble(this.time, 1) * shake * this.maxShake,
      offsetY: wobble(this.time, 7) * shake * this.maxShake,
      angle: wobble(this.time, 13) * shake * 0.03,
      zoom: this.punch,
      flash: this.flashColor,
      flashAmount: fade * fade * (this.reducedMotion ? 0.35 : 0.85),
      timeScale: this.stopLeft > 0 ? 0 : this.slowLeft > 0 ? this.slowScale : 1,
    };
  }
}
