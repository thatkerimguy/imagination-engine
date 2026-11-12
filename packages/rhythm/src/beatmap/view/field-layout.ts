import { FIELD_HEIGHT } from '@ie/story';

/** Theme colours for the canvas, read from the design tokens (the canvas can't use var()). */
export interface FieldPalette {
  readonly bg: string;
  readonly surface: string;
  readonly ink: string;
  readonly muted: string;
  readonly faint: string;
  readonly line: string;
  readonly lineStrong: string;
  readonly accent: string;
  readonly accentInk: string;
  readonly scrim: string;
  readonly font: string;
}

export function readPalette(element: Element): FieldPalette {
  const css = getComputedStyle(element);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    bg: v('--color-bg', 'Canvas'),
    surface: v('--color-surface-raised', 'Canvas'),
    ink: v('--color-ink', 'CanvasText'),
    muted: v('--color-ink-muted', 'GrayText'),
    faint: v('--color-ink-faint', 'GrayText'),
    line: v('--color-line', 'GrayText'),
    lineStrong: v('--color-line-strong', 'GrayText'),
    accent: v('--color-accent', 'Highlight'),
    accentInk: v('--color-accent-ink', 'HighlightText'),
    scrim: v('--color-scrim', 'transparent'),
    font: v('--font-ui', 'system-ui, sans-serif'),
  };
}

/**
 * Where the 4:3 field sits on the canvas, in CSS pixels. On a tall screen the field turns a
 * quarter clockwise, so it fills a phone held upright; the turn keeps every pattern's shape and
 * handedness.
 */
export interface FieldLayout {
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  /** CSS pixels per field width. */
  readonly scale: number;
  readonly ox: number;
  readonly oy: number;
  readonly rotated: boolean;
}

export interface FitOptions {
  /** Room kept free above and below for the HUD, in CSS pixels. */
  readonly top: number;
  readonly bottom: number;
  /** Margin around the field in field widths (circles at the edge stay whole). */
  readonly pad: number;
  readonly allowRotate: boolean;
}

export function fitField(width: number, height: number, dpr: number, o: FitOptions): FieldLayout {
  const w = Math.max(1, width);
  const h = Math.max(1, height - o.top - o.bottom);
  const rotated = o.allowRotate && h > w * 1.15;
  const fw = rotated ? FIELD_HEIGHT : 1;
  const fh = rotated ? 1 : FIELD_HEIGHT;
  const scale = Math.min(w / (fw + 2 * o.pad), h / (fh + 2 * o.pad));
  return {
    width,
    height,
    dpr,
    scale,
    ox: (w - fw * scale) / 2,
    oy: o.top + (h - fh * scale) / 2,
    rotated,
  };
}

/** Field point to CSS pixels. */
export function toScreen(
  l: FieldLayout,
  x: number,
  y: number,
  out: { x: number; y: number } = { x: 0, y: 0 },
): { x: number; y: number } {
  if (l.rotated) {
    out.x = l.ox + (FIELD_HEIGHT - y) * l.scale;
    out.y = l.oy + x * l.scale;
  } else {
    out.x = l.ox + x * l.scale;
    out.y = l.oy + y * l.scale;
  }
  return out;
}

/** CSS pixels (relative to the canvas) to a field point. */
export function toField(l: FieldLayout, sx: number, sy: number): { x: number; y: number } {
  if (l.rotated) return { x: (sy - l.oy) / l.scale, y: FIELD_HEIGHT - (sx - l.ox) / l.scale };
  return { x: (sx - l.ox) / l.scale, y: (sy - l.oy) / l.scale };
}

/** Draw in field units from here on. */
export function fieldTransform(ctx: CanvasRenderingContext2D, l: FieldLayout): void {
  const s = l.scale * l.dpr;
  if (l.rotated) ctx.setTransform(0, s, -s, 0, (l.ox + FIELD_HEIGHT * l.scale) * l.dpr, l.oy * l.dpr);
  else ctx.setTransform(s, 0, 0, s, l.ox * l.dpr, l.oy * l.dpr);
}

/** Draw in CSS pixels from here on. */
export function screenTransform(ctx: CanvasRenderingContext2D, l: FieldLayout): void {
  ctx.setTransform(l.dpr, 0, 0, l.dpr, 0, 0);
}

/** Sizes the canvas's backing store to its box; true when it changed. */
export function sizeCanvas(canvas: HTMLCanvasElement, maxDpr = 2): boolean {
  const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width === w && canvas.height === h) return false;
  canvas.width = w;
  canvas.height = h;
  return true;
}
