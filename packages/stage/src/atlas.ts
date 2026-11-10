import { sdfFromCoverage } from './sdf.ts';

/** Where a glyph sits in the atlas and how it is placed on a line, in atlas pixels. */
export interface AtlasGlyph {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** From the pen position on the baseline to the bitmap's left and top edges. */
  readonly left: number;
  readonly top: number;
  readonly advance: number;
}

export interface AtlasOptions {
  /** A CSS font family the page has loaded. */
  readonly family: string;
  readonly weight?: number | string;
  readonly style?: 'normal' | 'italic';
  /** Glyph size in the atlas. 48 px keeps titles crisp at several times that on screen. */
  readonly size?: number;
  /** How far the field reaches, in atlas pixels: room for outlines and glows. */
  readonly radius?: number;
  readonly width?: number;
  /** WebGL2 on the reference phone allows 4096 px textures (PLAN §11.1). */
  readonly maxHeight?: number;
}

/** Letters every novel needs: ASCII, Turkish, typographic punctuation and particle glyphs. */
export const BASE_CHARS =
  ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~' +
  'ÇĞİÖŞÜçğıöşüÂâÎîÛû' +
  '‘’“”«»–—…•·' +
  '✦✧★☆◆◇○●◦×÷±∞♪♫';

/** Shelf packing: rows of boxes, left to right, a new row when one is full. */
export class ShelfPacker {
  private x = 0;
  private y = 0;
  private row = 0;
  height = 0;

  constructor(
    readonly width: number,
    private readonly gap = 1,
  ) {}

  place(w: number, h: number): { x: number; y: number } {
    if (w > this.width) throw new Error('A glyph is wider than the atlas.');
    if (this.x + w > this.width) {
      this.x = 0;
      this.y += this.row + this.gap;
      this.row = 0;
    }
    const at = { x: this.x, y: this.y };
    this.x += w + this.gap;
    this.row = Math.max(this.row, h);
    this.height = Math.max(this.height, this.y + h);
    return at;
  }
}

type Canvas2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function makeContext(width: number, height: number): Canvas2D {
  if (typeof OffscreenCanvas !== 'undefined') {
    const ctx = new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true });
    if (ctx) return ctx;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No 2D canvas.');
  return ctx;
}

/**
 * A single-channel SDF glyph atlas that grows as text needs new letters. The pixels are kept on
 * the CPU so the stage can re-upload them after the GPU context is lost.
 */
export class GlyphAtlas {
  readonly size: number;
  readonly radius: number;
  readonly width: number;
  readonly ascent: number;
  readonly descent: number;
  readonly font: string;
  height: number;
  pixels: Uint8Array;
  /** Bumped whenever pixels change, so the stage knows to upload. */
  version = 0;
  private readonly glyphs = new Map<string, AtlasGlyph>();
  private readonly packer: ShelfPacker;
  private readonly maxHeight: number;
  private readonly ctx: Canvas2D;

  constructor(options: AtlasOptions) {
    this.size = options.size ?? 48;
    this.radius = options.radius ?? Math.round(this.size / 6);
    this.width = options.width ?? 1024;
    this.maxHeight = options.maxHeight ?? 4096;
    this.height = 256;
    this.pixels = new Uint8Array(this.width * this.height);
    this.packer = new ShelfPacker(this.width);
    this.font = `${options.style ?? 'normal'} ${options.weight ?? 400} ${this.size}px ${options.family}`;
    const cell = Math.ceil(this.size * 2 + this.radius * 2);
    this.ctx = makeContext(cell, cell);
    this.ctx.font = this.font;
    const m = this.ctx.measureText('Hİg');
    this.ascent = m.fontBoundingBoxAscent || this.size * 0.8;
    this.descent = m.fontBoundingBoxDescent || this.size * 0.2;
  }

  get(char: string): AtlasGlyph | undefined {
    return this.glyphs.get(char);
  }

  /** Adds any letters of `text` the atlas lacks. Returns whether it added any. */
  ensure(text: string): boolean {
    let added = false;
    for (const char of text) {
      if (this.glyphs.has(char)) continue;
      this.add(char);
      added = true;
    }
    if (added) this.version++;
    return added;
  }

  private add(char: string): void {
    const { ctx, radius } = this;
    ctx.font = this.font;
    const m = ctx.measureText(char);
    const advance = m.width;
    const left = Math.ceil(m.actualBoundingBoxLeft);
    const ascent = Math.ceil(m.actualBoundingBoxAscent);
    const glyphW = Math.max(0, left + Math.ceil(m.actualBoundingBoxRight));
    const glyphH = Math.max(0, ascent + Math.ceil(m.actualBoundingBoxDescent));
    if (glyphW === 0 || glyphH === 0 || char.trim() === '') {
      this.glyphs.set(char, { x: 0, y: 0, w: 0, h: 0, left: 0, top: 0, advance });
      return;
    }
    const w = Math.min(ctx.canvas.width, glyphW + radius * 2);
    const h = Math.min(ctx.canvas.height, glyphH + radius * 2);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(char, radius + left, radius + ascent);
    const rgba = ctx.getImageData(0, 0, w, h).data;
    const alpha = new Uint8Array(w * h);
    for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3] ?? 0;
    const sdf = sdfFromCoverage(alpha, w, h, radius);

    const at = this.packer.place(w, h);
    while (this.packer.height > this.height) this.grow();
    for (let row = 0; row < h; row++)
      this.pixels.set(sdf.subarray(row * w, row * w + w), (at.y + row) * this.width + at.x);
    this.glyphs.set(char, { ...at, w, h, left: radius + left, top: radius + ascent, advance });
  }

  private grow(): void {
    if (this.height * 2 > this.maxHeight) throw new Error('The glyph atlas is full.');
    const pixels = new Uint8Array(this.width * this.height * 2);
    pixels.set(this.pixels);
    this.pixels = pixels;
    this.height *= 2;
  }
}
