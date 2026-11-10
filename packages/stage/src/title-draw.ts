import type { TitleActor } from './actors.ts';
import type { GlyphAtlas } from './atlas.ts';
import type { SpriteBatch } from './batch.ts';
import { SHAPE } from './renderer.ts';

/**
 * Pushes a title's glyphs for this frame. Each glyph carries its index in the sprite's spare
 * parameter, which a text material reads as Glyph index (ADR 0020).
 */
export function pushTitle(
  batch: SpriteBatch,
  atlas: GlyphAtlas,
  title: TitleActor,
  reducedMotion: boolean,
  pulse: number,
  glow: number,
): void {
  const { width, height } = atlas;
  title.each(reducedMotion, pulse, (g, alpha, lift, scale) => {
    batch.push(
      g.x,
      g.y + lift,
      g.hw * scale,
      g.hh * scale,
      0,
      g.glyph.x / width,
      g.glyph.y / height,
      (g.glyph.x + g.glyph.w) / width,
      (g.glyph.y + g.glyph.h) / height,
      title.color,
      alpha,
      SHAPE.glyph,
      0,
      glow,
      g.index,
    );
  });
}
