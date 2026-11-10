import type { Rgb } from './actors.ts';
import type { GlyphAtlas } from './atlas.ts';
import { SHAPE, SPRITE_FLOATS } from './renderer.ts';

/** The frame's sprites as one interleaved buffer for the instanced draw; it grows, never shrinks. */
export class SpriteBatch {
  data = new Float32Array(SPRITE_FLOATS * 1024);
  count = 0;

  constructor(private readonly atlas: GlyphAtlas) {}

  push(
    cx: number,
    cy: number,
    hw: number,
    hh: number,
    angle: number,
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    rgb: Rgb,
    a: number,
    kind: number,
    p1 = 0,
    p2 = 0,
    p3 = 0,
  ): void {
    if ((this.count + 1) * SPRITE_FLOATS > this.data.length) {
      const bigger = new Float32Array(this.data.length * 2);
      bigger.set(this.data);
      this.data = bigger;
    }
    const d = this.data;
    let o = this.count++ * SPRITE_FLOATS;
    d[o++] = cx;
    d[o++] = cy;
    d[o++] = hw;
    d[o++] = hh;
    d[o++] = angle;
    d[o++] = u0;
    d[o++] = v0;
    d[o++] = u1;
    d[o++] = v1;
    d[o++] = rgb[0];
    d[o++] = rgb[1];
    d[o++] = rgb[2];
    d[o++] = a;
    d[o++] = kind;
    d[o++] = p1;
    d[o++] = p2;
    d[o] = p3;
  }

  glyph(
    char: string,
    cx: number,
    cy: number,
    size: number,
    angle: number,
    rgb: Rgb,
    a: number,
    glow = 0,
  ): void {
    const g = this.atlas.get(char);
    if (!g || g.w === 0) return;
    const s = size / this.atlas.size;
    const { width, height } = this.atlas;
    this.push(
      cx,
      cy,
      (g.w * s) / 2,
      (g.h * s) / 2,
      angle,
      g.x / width,
      g.y / height,
      (g.x + g.w) / width,
      (g.y + g.h) / height,
      rgb,
      a,
      SHAPE.glyph,
      0,
      glow,
    );
  }
}
