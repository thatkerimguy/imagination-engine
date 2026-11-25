// GET /og/<slug>.png: 1200x630 generated card. Dark tint of the novel's accent plus a motif seeded
// by the slug hash. No text rendering.
import type { HandlerConfig } from './config.ts';
import { fail } from './http.ts';
import { isSlugId } from './protocol.ts';
import { encodePng } from './png.ts';
import { TAKEN_DOWN_MESSAGE, isTakenDown, readNovelDoc } from './takedown.ts';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
const DEFAULT_ACCENT = '#c8553d';

type Rgb = [number, number, number];

export function parseHexColor(value: unknown): Rgb | null {
  if (typeof value !== 'string') return null;
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(value.trim());
  const hex = m?.[1];
  if (!hex) return null;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
}

/** `accentColor`, else `theme['--accent']`, else the default. */
export function accentOf(novel: Record<string, unknown>): Rgb {
  const theme = novel.theme;
  const fromTheme =
    typeof theme === 'object' && theme !== null
      ? (theme as Record<string, unknown>)['--accent']
      : undefined;
  return (
    parseHexColor(novel.accentColor) ??
    parseHexColor(fromTheme) ??
    (parseHexColor(DEFAULT_ACCENT) as Rgb)
  );
}

export function hashSlug(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) h = Math.imul(h ^ slug.charCodeAt(i), 16777619);
  return h >>> 0;
}

const BANDS = 8; // vertical shade bands
const LEVELS = 16; // accent mix levels (0 = background, 15 = solid accent)
const RING_MAX = 460;

export interface OgCard {
  /** BANDS*LEVELS RGB triples. */
  palette: Uint8Array;
  /** One palette index per pixel, top row first. */
  pixels: Uint8Array;
}

function buildPalette([ar, ag, ab]: Rgb): Uint8Array {
  const pal = new Uint8Array(BANDS * LEVELS * 3);
  for (let band = 0; band < BANDS; band++) {
    const shade = 0.1 + 0.06 * ((band + 0.5) / BANDS);
    const base = [12 + ar * shade, 12 + ag * shade, 14 + ab * shade];
    const acc = [ar, ag, ab];
    for (let lvl = 0; lvl < LEVELS; lvl++) {
      const mix = lvl / (LEVELS - 1);
      for (let c = 0; c < 3; c++) {
        const b0 = base[c] ?? 0;
        pal[(band * LEVELS + lvl) * 3 + c] = Math.round(b0 + ((acc[c] ?? 0) - b0) * mix);
      }
    }
  }
  return pal;
}

/**
 * Indexed 1200x630 card: shaded background, slug-seeded concentric rings and diagonal bands, and
 * an accent bar on the left. Rings are filled as per-row spans (a few square roots per row, not per
 * pixel), so a render plus encode stays well inside a Worker's CPU budget.
 */
export function renderOgCard(slug: string, accent: Rgb): OgCard {
  const w = OG_WIDTH;
  const h = OG_HEIGHT;
  const seed = hashSlug(slug);
  const cx = 620 + (seed % 460);
  const cy = 80 + ((seed >>> 8) % 470);
  const period = 38 + ((seed >>> 16) % 26);
  const band = 70 + ((seed >>> 20) % 50);
  const flip = (seed >>> 28) & 1;
  const rings: Array<[number, number, number]> = []; // [inner², outer², level]
  for (let r = 0; r < RING_MAX; r += period) {
    const outer = Math.min(r + 7, RING_MAX);
    const level = Math.round(15 * (0.35 + 0.4 * (1 - (r + 3.5) / RING_MAX)));
    rings.push([r * r, outer * outer, level]);
  }
  const pixels = new Uint8Array(w * h);
  const fillSpan = (off: number, from: number, to: number, value: number): void => {
    const a = Math.max(36, Math.ceil(from));
    const b = Math.min(w, Math.ceil(to));
    if (a < b) pixels.fill(value, off + a, off + b);
  };
  for (let y = 0; y < h; y++) {
    const off = y * w;
    const shade = Math.floor((y * BANDS) / h) * LEVELS;
    pixels.fill(shade, off, off + w);
    // Diagonal bands: 8 px wide every `band` px, phase shifting by one px per row.
    const phase = (flip ? h - y : y) % band;
    for (let x = (band - phase) % band; x < w; x += band) fillSpan(off, x, x + 8, shade + 2);
    const dy2 = (y - cy) * (y - cy);
    for (const [in2, out2, lvl] of rings) {
      if (dy2 >= out2) continue;
      const o = Math.sqrt(out2 - dy2);
      const i = dy2 < in2 ? Math.sqrt(in2 - dy2) : 0;
      fillSpan(off, cx - o, cx - i, shade + lvl);
      fillSpan(off, cx + i, cx + o, shade + lvl);
    }
    // Accent bar, then a faint glow strip that keeps any brighter ring pixels.
    pixels.fill(shade + 15, off, off + 36);
    for (let x = off + 36; x < off + 52; x++) {
      if ((pixels[x] ?? 0) - shade < 3) pixels[x] = shade + 3;
    }
  }
  return { palette: buildPalette(accent), pixels };
}

export async function ogImageResponse(slug: string, config: HandlerConfig): Promise<Response> {
  if (!isSlugId(slug)) return fail('Not found', 404);
  if (await isTakenDown(config.store, slug)) return fail(TAKEN_DOWN_MESSAGE, 410);
  const novel = await readNovelDoc(config.store, slug);
  if (!novel) return fail('Not found', 404);
  const card = renderOgCard(slug, accentOf(novel));
  const png = await encodePng(OG_WIDTH, OG_HEIGHT, card.pixels, card.palette);
  return new Response(png as BodyInit, {
    status: 200,
    headers: { 'content-type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
  });
}
