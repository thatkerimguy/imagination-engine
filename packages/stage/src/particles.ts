/**
 * Glyph particles: characters such as `* · + ✦ /` thrown, dropped and faded on the CPU and drawn
 * as instanced SDF quads. Arrays of numbers rather than objects, so thousands of particles cost no
 * garbage per frame (PLAN §11.1 allows 3,000 on the reference phone).
 */

export interface ParticleSpec {
  readonly glyphs: string;
  /** Particles per burst, or per second for a continuous emitter. */
  readonly count: number;
  /** Speed range in CSS px per second. */
  readonly speed: readonly [number, number];
  /** Direction and spread in radians (0 = right, -π/2 = up). */
  readonly angle: number;
  readonly spread: number;
  readonly life: readonly [number, number];
  /** Glyph size range in CSS px. */
  readonly size: readonly [number, number];
  readonly gravity: number;
  /** Fraction of velocity lost per second. */
  readonly drag: number;
  readonly spin: number;
  readonly color: readonly [number, number, number];
  /** Grows (positive) or shrinks (negative) over life. */
  readonly grow?: number;
  /** Twinkles instead of fading out smoothly. */
  readonly twinkle?: boolean;
  /** Turn to face the direction of travel (rain streaks). */
  readonly align?: boolean;
}

/** The built-in looks. Colours are multiplied by the stage's ink colour. */
export const PARTICLE_PRESETS = {
  burst: {
    glyphs: '*+·✦',
    count: 60,
    speed: [120, 520],
    angle: 0,
    spread: Math.PI * 2,
    life: [0.5, 1.1],
    size: [10, 26],
    gravity: 300,
    drag: 1.6,
    spin: 6,
    color: [1, 1, 1],
    grow: -0.6,
  },
  sparks: {
    glyphs: '·•',
    count: 40,
    speed: [300, 800],
    angle: -Math.PI / 2,
    spread: Math.PI * 0.9,
    life: [0.3, 0.7],
    size: [6, 14],
    gravity: 900,
    drag: 0.8,
    spin: 0,
    color: [1, 0.75, 0.4],
    align: true,
  },
  confetti: {
    glyphs: '▪▬●◆',
    count: 70,
    speed: [300, 700],
    angle: -Math.PI / 2,
    spread: Math.PI * 0.7,
    life: [1.4, 2.4],
    size: [6, 12],
    gravity: 520,
    drag: 1.4,
    spin: 8,
    color: [1, 0.85, 0.45],
  },
  hearts: {
    glyphs: '♥',
    count: 18,
    speed: [60, 180],
    angle: -Math.PI / 2,
    spread: Math.PI * 0.6,
    life: [1.2, 2.2],
    size: [12, 26],
    gravity: -60,
    drag: 1.2,
    spin: 0.6,
    color: [1, 0.45, 0.55],
    grow: 0.3,
  },
  smoke: {
    glyphs: '●',
    count: 26,
    speed: [20, 90],
    angle: -Math.PI / 2,
    spread: Math.PI * 0.8,
    life: [1.6, 2.8],
    size: [18, 40],
    gravity: -40,
    drag: 0.9,
    spin: 0,
    color: [0.55, 0.55, 0.58],
    grow: 1.4,
  },
  magic: {
    glyphs: '✦✧⋆·',
    count: 45,
    speed: [60, 260],
    angle: 0,
    spread: Math.PI * 2,
    life: [0.8, 1.6],
    size: [8, 18],
    gravity: -30,
    drag: 1.8,
    spin: 4,
    color: [0.75, 0.6, 1],
    twinkle: true,
  },
  rain: {
    glyphs: '|',
    count: 140,
    speed: [700, 950],
    angle: Math.PI * 0.58,
    spread: 0.04,
    life: [1.2, 1.6],
    size: [12, 22],
    gravity: 0,
    drag: 0,
    spin: 0,
    color: [0.7, 0.8, 1],
    align: true,
  },
  embers: {
    glyphs: '·•',
    count: 24,
    speed: [20, 70],
    angle: -Math.PI / 2,
    spread: 0.8,
    life: [3, 6],
    size: [6, 14],
    gravity: -12,
    drag: 0.2,
    spin: 0,
    color: [1, 0.55, 0.25],
    twinkle: true,
  },
  stars: {
    glyphs: '·✦+',
    count: 8,
    speed: [0, 4],
    angle: 0,
    spread: Math.PI * 2,
    life: [4, 9],
    size: [6, 16],
    gravity: 0,
    drag: 0,
    spin: 0.3,
    color: [0.9, 0.9, 1],
    twinkle: true,
  },
} as const satisfies Record<string, ParticleSpec>;

export type ParticlePreset = keyof typeof PARTICLE_PRESETS;

/** A deterministic random source, so tests and replays see the same particles. */
export function random(seed = 1): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export interface ParticleView {
  readonly count: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly size: Float32Array;
  readonly angle: Float32Array;
  readonly alpha: Float32Array;
  readonly r: Float32Array;
  readonly g: Float32Array;
  readonly b: Float32Array;
  readonly glyph: readonly string[];
}

export class ParticleSystem implements ParticleView {
  count = 0;
  readonly x: Float32Array;
  readonly y: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  readonly size: Float32Array;
  private readonly size0: Float32Array;
  readonly angle: Float32Array;
  private readonly spin: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  readonly alpha: Float32Array;
  readonly r: Float32Array;
  readonly g: Float32Array;
  readonly b: Float32Array;
  readonly glyph: string[];
  private readonly specOf: (ParticleSpec | undefined)[];
  private readonly rand: () => number;

  constructor(
    public capacity: number,
    seed = 1,
  ) {
    const f = () => new Float32Array(capacity);
    this.x = f();
    this.y = f();
    this.vx = f();
    this.vy = f();
    this.size = f();
    this.size0 = f();
    this.angle = f();
    this.spin = f();
    this.age = f();
    this.life = f();
    this.alpha = f();
    this.r = f();
    this.g = f();
    this.b = f();
    this.glyph = new Array<string>(capacity).fill('');
    this.specOf = new Array<ParticleSpec | undefined>(capacity);
    this.rand = random(seed);
  }

  /** Throws `count` particles from a point (or a random spot in a box). Returns how many fit. */
  emit(
    spec: ParticleSpec,
    at: { x: number; y: number; w?: number; h?: number },
    count = spec.count,
  ): number {
    const glyphs = [...spec.glyphs];
    let made = 0;
    const room = Math.min(count, this.capacity - this.count);
    for (let n = 0; n < room; n++) {
      const i = this.count++;
      const rnd = this.rand;
      const between = (range: readonly [number, number]) =>
        range[0] + (range[1] - range[0]) * rnd();
      const dir = spec.angle + (rnd() - 0.5) * spec.spread;
      const speed = between(spec.speed);
      this.x[i] = at.x + (at.w ?? 0) * rnd();
      this.y[i] = at.y + (at.h ?? 0) * rnd();
      this.vx[i] = Math.cos(dir) * speed;
      this.vy[i] = Math.sin(dir) * speed;
      this.size0[i] = between(spec.size);
      this.size[i] = this.size0[i] ?? 0;
      this.angle[i] = spec.align ? dir + Math.PI / 2 : rnd() * Math.PI * 2;
      this.spin[i] = spec.align ? 0 : (rnd() - 0.5) * 2 * spec.spin;
      this.age[i] = 0;
      this.life[i] = between(spec.life);
      this.alpha[i] = 1;
      this.r[i] = spec.color[0];
      this.g[i] = spec.color[1];
      this.b[i] = spec.color[2];
      this.glyph[i] = glyphs[Math.floor(rnd() * glyphs.length)] ?? '·';
      this.specOf[i] = spec;
      made++;
    }
    return made;
  }

  /** Adds one particle with a given glyph and velocity (text shattering into its letters). */
  add(
    glyph: string,
    x: number,
    y: number,
    vx: number,
    vy: number,
    size: number,
    spec: ParticleSpec,
  ): void {
    if (this.count >= this.capacity) return;
    const i = this.count++;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.size0[i] = size;
    this.size[i] = size;
    this.angle[i] = 0;
    this.spin[i] = (this.rand() - 0.5) * 2 * spec.spin;
    this.age[i] = 0;
    this.life[i] = spec.life[0] + (spec.life[1] - spec.life[0]) * this.rand();
    this.alpha[i] = 1;
    this.r[i] = spec.color[0];
    this.g[i] = spec.color[1];
    this.b[i] = spec.color[2];
    this.glyph[i] = glyph;
    this.specOf[i] = spec;
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.count) {
      const spec = this.specOf[i];
      const age = (this.age[i] ?? 0) + dt;
      const life = this.life[i] ?? 1;
      if (!spec || age >= life) {
        this.kill(i);
        continue;
      }
      this.age[i] = age;
      const drag = Math.exp(-spec.drag * dt);
      const vx = (this.vx[i] ?? 0) * drag;
      const vy = ((this.vy[i] ?? 0) + spec.gravity * dt) * drag;
      this.vx[i] = vx;
      this.vy[i] = vy;
      this.x[i] = (this.x[i] ?? 0) + vx * dt;
      this.y[i] = (this.y[i] ?? 0) + vy * dt;
      this.angle[i] = spec.align
        ? Math.atan2(vy, vx) + Math.PI / 2
        : (this.angle[i] ?? 0) + (this.spin[i] ?? 0) * dt;
      const t = age / life;
      this.size[i] = (this.size0[i] ?? 0) * Math.max(0, 1 + (spec.grow ?? 0) * t);
      this.alpha[i] = spec.twinkle
        ? Math.sin(Math.PI * t) * (0.6 + 0.4 * Math.sin(age * 9 + i))
        : Math.min(1, (1 - t) * 3) * Math.min(1, t * 20);
      i++;
    }
  }

  clear(): void {
    this.count = 0;
  }

  /** Swaps the last live particle into slot i, so live particles stay packed at the front. */
  private kill(i: number): void {
    const last = --this.count;
    if (i === last) return;
    for (const a of [
      this.x,
      this.y,
      this.vx,
      this.vy,
      this.size,
      this.size0,
      this.angle,
      this.spin,
      this.age,
      this.life,
      this.alpha,
      this.r,
      this.g,
      this.b,
    ])
      a[i] = a[last] ?? 0;
    this.glyph[i] = this.glyph[last] ?? '';
    this.specOf[i] = this.specOf[last];
  }
}
