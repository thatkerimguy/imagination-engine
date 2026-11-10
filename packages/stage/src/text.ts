import type { AtlasGlyph } from './atlas.ts';

/** What layout needs from an atlas: glyph metrics at the atlas's own size. */
export interface Metrics {
  readonly size: number;
  readonly ascent: number;
  readonly descent: number;
  get(char: string): AtlasGlyph | undefined;
}

export interface PlacedGlyph {
  readonly char: string;
  /** Centre of the glyph's quad, in CSS px. */
  readonly x: number;
  readonly y: number;
  /** Half-size of the quad, in CSS px. */
  readonly hw: number;
  readonly hh: number;
  readonly glyph: AtlasGlyph;
  /** Position in the text, for staggered entrances. */
  readonly index: number;
}

export interface LayoutOptions {
  /** Font size in CSS px. */
  readonly size: number;
  readonly maxWidth: number;
  /** Centre of the text block. */
  readonly x: number;
  readonly y: number;
  readonly lineHeight?: number;
  /** Extra space between letters, as a fraction of the size. */
  readonly tracking?: number;
}

/**
 * Lays text out in centred lines that wrap at spaces, for titles and stage text. Letters come from
 * the atlas at its own size and are scaled; every quad keeps the SDF's margin, so glows fit.
 */
export function layoutText(text: string, metrics: Metrics, options: LayoutOptions): PlacedGlyph[] {
  const scale = options.size / metrics.size;
  const tracking = (options.tracking ?? 0) * options.size;
  const advance = (char: string) => (metrics.get(char)?.advance ?? 0) * scale + tracking;
  const words = text.split(/(\s+)/).filter((w) => w.length > 0);

  // Greedy wrapping; a word longer than the line gets a line of its own.
  const lines: string[] = [];
  let line = '';
  let width = 0;
  for (const word of words) {
    const w = [...word].reduce((sum, c) => sum + advance(c), 0);
    if (/^\s+$/.test(word)) {
      if (line) {
        line += ' ';
        width += advance(' ');
      }
      continue;
    }
    if (line && width + w > options.maxWidth) {
      lines.push(line.trimEnd());
      line = '';
      width = 0;
    }
    line += word;
    width += w;
  }
  if (line.trim()) lines.push(line.trimEnd());

  const lineHeight = (options.lineHeight ?? 1.2) * options.size;
  const top = options.y - (lines.length * lineHeight) / 2;
  const placed: PlacedGlyph[] = [];
  let index = 0;
  lines.forEach((text, row) => {
    const chars = [...text];
    const lineWidth = chars.reduce((sum, c) => sum + advance(c), 0) - tracking;
    let pen = options.x - lineWidth / 2;
    // Baseline: centre the font's ascent and descent in the line box.
    const baseline =
      top + row * lineHeight + lineHeight / 2 + ((metrics.ascent - metrics.descent) / 2) * scale;
    for (const char of chars) {
      const glyph = metrics.get(char);
      if (glyph && glyph.w > 0) {
        const hw = (glyph.w * scale) / 2;
        const hh = (glyph.h * scale) / 2;
        placed.push({
          char,
          x: pen - glyph.left * scale + hw,
          y: baseline - glyph.top * scale + hh,
          hw,
          hh,
          glyph,
          index,
        });
      }
      pen += advance(char);
      index++;
    }
  });
  return placed;
}
