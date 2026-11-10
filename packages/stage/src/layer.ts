import type { Rgb } from './actors.ts';
import type { SpriteBatch } from './batch.ts';
import { SHAPE } from './renderer.ts';
import type { StagePalette } from './stage.ts';

/** Draws shapes and glyphs in CSS pixels, into the stage's one instanced draw. */
export interface StagePen {
  readonly width: number;
  readonly height: number;
  readonly palette: StagePalette;
  /** A ring of `radius` px with a `thickness` px line. */
  ring(x: number, y: number, radius: number, thickness: number, rgb: Rgb, alpha: number): void;
  disc(x: number, y: number, radius: number, rgb: Rgb, alpha: number): void;
  /** A soft-ended bar of `length` by `width` px, turned by `angle` radians. */
  slash(
    x: number,
    y: number,
    length: number,
    width: number,
    angle: number,
    rgb: Rgb,
    alpha: number,
  ): void;
  glyph(char: string, x: number, y: number, size: number, rgb: Rgb, alpha: number): void;
}

/**
 * Something that draws on the stage every frame while it is set: the rhythm fight's notes, for
 * one. Return false from `draw` when there is nothing left to animate.
 */
export interface StageLayer {
  /** `time` is the stage clock in seconds; it stops during hit-stop. */
  draw(pen: StagePen, time: number): boolean;
  /** Characters the layer will draw, so their glyphs are ready before the first frame. */
  readonly glyphs?: string;
}

/** A pen over the stage's sprite batch. */
export function createPen(
  batch: SpriteBatch,
  view: () => { readonly w: number; readonly h: number },
  palette: () => StagePalette,
): StagePen {
  return {
    get width() {
      return view().w;
    },
    get height() {
      return view().h;
    },
    get palette() {
      return palette();
    },
    ring(x, y, radius, thickness, rgb, alpha) {
      if (radius <= 0) return;
      batch.push(
        x,
        y,
        radius,
        radius,
        0,
        0,
        0,
        0,
        0,
        rgb,
        alpha,
        SHAPE.ring,
        Math.min(1, thickness / radius / 2),
      );
    },
    disc(x, y, radius, rgb, alpha) {
      if (radius <= 0) return;
      batch.push(x, y, radius, radius, 0, 0, 0, 0, 0, rgb, alpha, SHAPE.disc);
    },
    slash(x, y, length, width, angle, rgb, alpha) {
      batch.push(x, y, length / 2, width / 2, angle, 0, 0, 0, 0, rgb, alpha, SHAPE.slash);
    },
    glyph(char, x, y, size, rgb, alpha) {
      batch.glyph(char, x, y, size, 0, rgb, alpha);
    },
  };
}
