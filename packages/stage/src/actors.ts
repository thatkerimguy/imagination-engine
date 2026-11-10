import type { GlyphAtlas } from './atlas.ts';
import type { ParticleSpec, ParticleSystem } from './particles.ts';
import { layoutText, type PlacedGlyph } from './text.ts';

export type Rgb = readonly [number, number, number];

/** Letters thrown apart when a title shatters. */
export const SHATTER: ParticleSpec = {
  glyphs: '',
  count: 0,
  speed: [80, 320],
  angle: 0,
  spread: Math.PI * 2,
  life: [0.7, 1.3],
  size: [0, 0],
  gravity: 520,
  drag: 1.2,
  spin: 5,
  color: [1, 1, 1],
  grow: -0.3,
};

const STAGGER = 0.035;
const ENTER = 0.45;
const EXIT = 0.5;

/** Large text on the stage: letters rise in one after another, hold, then fade or shatter. */
export class TitleActor {
  private age = 0;
  private leaving = -1;
  readonly glyphs: PlacedGlyph[];

  constructor(
    readonly text: string,
    atlas: GlyphAtlas,
    view: { w: number; h: number },
    readonly color: Rgb,
    readonly seconds: number,
    readonly exit: 'fade' | 'shatter',
  ) {
    atlas.ensure(text);
    // As large as fits: up to an eighth of the short side, smaller for long titles.
    const short = Math.min(view.w, view.h);
    const size = Math.max(28, Math.min(short / 8, (view.w * 1.6) / Math.max(4, [...text].length)));
    this.glyphs = layoutText(text, atlas, {
      size,
      maxWidth: view.w * 0.86,
      x: view.w / 2,
      y: view.h * 0.42,
      tracking: 0.02,
    });
  }

  get done(): boolean {
    return this.leaving >= 0 && this.age - this.leaving > EXIT;
  }

  /** Starts the exit now (a new title, or the reader moved on). */
  leave(particles: ParticleSystem, reducedMotion: boolean): void {
    if (this.leaving >= 0) return;
    this.leaving = this.age;
    if (this.exit === 'shatter' && !reducedMotion) {
      const spec = { ...SHATTER, color: this.color };
      for (const g of this.glyphs) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 240;
        particles.add(
          g.char,
          g.x,
          g.y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed - 160,
          g.hh * 2,
          spec,
        );
      }
      // The particles carry the letters from here.
      this.leaving = this.age - EXIT;
    }
  }

  update(dt: number, particles: ParticleSystem, reducedMotion: boolean): void {
    this.age += dt;
    const last = (this.glyphs.at(-1)?.index ?? 0) * STAGGER + ENTER;
    if (this.leaving < 0 && this.age > last + this.seconds) this.leave(particles, reducedMotion);
  }

  /** Per-letter alpha and lift for this frame; `pulse` swells the text on the beat. */
  each(
    reducedMotion: boolean,
    pulse: number,
    draw: (g: PlacedGlyph, alpha: number, lift: number, scale: number) => void,
  ): void {
    const out = this.leaving >= 0 ? Math.max(0, 1 - (this.age - this.leaving) / EXIT) : 1;
    for (const g of this.glyphs) {
      const t = Math.min(1, Math.max(0, (this.age - g.index * STAGGER) / ENTER));
      const ease = 1 - (1 - t) ** 3;
      const lift = reducedMotion ? 0 : (1 - ease) * g.hh * 0.8;
      draw(g, ease * out, lift, 1 + pulse * 0.05);
    }
  }
}

export interface Ambient {
  readonly spec: ParticleSpec;
  /** Where new particles start, as fractions of the view (x, y, w, h). */
  readonly area: readonly [number, number, number, number];
  /** Particles per second at amount 1. */
  readonly rate: number;
}

/** Continuous backgrounds: emitters that keep a gentle, steady number of particles alive. */
export const AMBIENTS: Readonly<Record<string, Ambient>> = {
  rain: {
    spec: {
      glyphs: '|',
      count: 0,
      speed: [700, 900],
      angle: Math.PI * 0.6,
      spread: 0.03,
      life: [1.4, 1.8],
      size: [10, 18],
      gravity: 0,
      drag: 0,
      spin: 0,
      color: [0.65, 0.75, 0.95],
      align: true,
    },
    area: [-0.1, -0.15, 1.3, 0.05],
    rate: 90,
  },
  embers: {
    spec: {
      glyphs: '·•',
      count: 0,
      speed: [25, 70],
      angle: -Math.PI / 2,
      spread: 0.7,
      life: [4, 7],
      size: [6, 13],
      gravity: -10,
      drag: 0.15,
      spin: 0,
      color: [1, 0.55, 0.25],
      twinkle: true,
    },
    area: [0, 1.0, 1, 0.05],
    rate: 9,
  },
  stars: {
    spec: {
      glyphs: '·✦+·',
      count: 0,
      speed: [0, 3],
      angle: 0,
      spread: Math.PI * 2,
      life: [4, 9],
      size: [5, 14],
      gravity: 0,
      drag: 0,
      spin: 0.2,
      color: [0.9, 0.9, 1],
      twinkle: true,
    },
    area: [0, 0, 1, 1],
    rate: 7,
  },
  snow: {
    spec: {
      glyphs: '·*•',
      count: 0,
      speed: [30, 60],
      angle: Math.PI / 2,
      spread: 0.5,
      life: [8, 12],
      size: [6, 14],
      gravity: 0,
      drag: 0,
      spin: 1,
      color: [1, 1, 1],
    },
    area: [-0.05, -0.05, 1.1, 0.02],
    rate: 12,
  },
};
