// Pre-baked procedural surface tiles: one 128×128 Canvas 2D draw per (material, theme, grain
// step), cached as a CSS `url(data:…)` value. Engines use it as a repeating background, so there
// are no per-frame SVG filters (feTurbulence) and no bitmap downloads. Deterministic Mulberry32
// noise seeded by the material name keeps tiles identical across sessions.
import type { DnaTheme, SurfaceMaterial } from '@kn/core/dna';

const SIZE = 128;
const cache = new Map<string, string>();

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedOf = (s: string): number =>
  [...s].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261);

type Ink = (alpha: number) => string;
type Painter = (g: CanvasRenderingContext2D, rnd: () => number, ink: Ink, k: number) => void;

function speckle(
  g: CanvasRenderingContext2D,
  rnd: () => number,
  ink: Ink,
  n: number,
  a: [number, number],
): void {
  for (let i = 0; i < n; i++) {
    g.fillStyle = ink(a[0] + rnd() * (a[1] - a[0]));
    g.fillRect(Math.floor(rnd() * SIZE), Math.floor(rnd() * SIZE), 1, 1);
  }
}

const PAINTERS: Record<Exclude<SurfaceMaterial, 'clean'>, Painter> = {
  'paper-grain': (g, rnd, ink, k) => {
    speckle(g, rnd, ink, Math.round(1400 * k), [0.04, 0.08]);
    g.lineWidth = 0.6;
    for (let i = 0; i < 6; i++) {
      const x = rnd() * SIZE;
      const y = rnd() * SIZE;
      g.strokeStyle = ink(0.05);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 10 + rnd() * 14, y + 6 + rnd() * 10);
      g.stroke();
    }
  },
  parchment: (g, rnd, ink, k) => {
    for (let i = 0; i < 9; i++) {
      const x = rnd() * SIZE;
      const y = rnd() * SIZE;
      const r = 18 + rnd() * 34;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, ink(0.07 * k));
      grad.addColorStop(1, ink(0));
      g.fillStyle = grad;
      // Draw the blot and its wrapped copies so the tile stays seamless.
      for (const [dx, dy] of [
        [0, 0],
        [-SIZE, 0],
        [SIZE, 0],
        [0, -SIZE],
        [0, SIZE],
      ] as const) {
        g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    }
    speckle(g, rnd, ink, Math.round(900 * k), [0.03, 0.07]);
  },
  'crt-glass': (g, rnd, ink, k) => {
    for (let y = 0; y < SIZE; y += 2) {
      g.fillStyle = ink(0.08 * k);
      g.fillRect(0, y, SIZE, 1);
    }
    for (let x = 0; x < SIZE; x += 3) {
      g.fillStyle = ink(0.025 * k);
      g.fillRect(x, 0, 1, SIZE);
    }
    speckle(g, rnd, ink, Math.round(300 * k), [0.02, 0.05]);
  },
  'brushed-metal': (g, rnd, ink, k) => {
    for (let y = 0; y < SIZE; y++) {
      g.fillStyle = ink((0.02 + rnd() * 0.06) * k);
      g.fillRect(0, y, SIZE, 1);
    }
    for (let i = 0; i < 4; i++) {
      g.fillStyle = ink(0.03 * k);
      g.fillRect(0, Math.floor(rnd() * SIZE), SIZE, 6 + Math.floor(rnd() * 10));
    }
  },
  linen: (g, rnd, ink, k) => {
    for (let i = 0; i < SIZE; i += 4) {
      g.fillStyle = ink((0.05 + rnd() * 0.03) * k);
      g.fillRect(0, i, SIZE, 1);
      g.fillStyle = ink((0.04 + rnd() * 0.03) * k);
      g.fillRect(i + 2, 0, 1, SIZE);
    }
  },
  newsprint: (g, rnd, ink, k) => {
    for (let y = 2; y < SIZE; y += 6) {
      for (let x = (y / 6) % 2 ? 5 : 2; x < SIZE; x += 6) {
        g.fillStyle = ink((0.08 + rnd() * 0.1) * k);
        g.beginPath();
        g.arc(x, y, 0.8 + rnd() * 0.9, 0, Math.PI * 2);
        g.fill();
      }
    }
  },
};

/**
 * Tile for a material as a CSS background value: `url(data:image/png;base64,…)`, or `'none'` for
 * `clean`, zero grain, or when Canvas 2D is unavailable (jsdom / happy-dom in tests).
 */
export function surfaceTile(material: SurfaceMaterial, theme: DnaTheme, grain = 0.5): string {
  if (material === 'clean' || grain <= 0 || typeof document === 'undefined') return 'none';
  const step = Math.max(1, Math.min(4, Math.round(grain * 4)));
  const key = `${material}:${theme}:${step}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let url = 'none';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const g = canvas.getContext('2d');
    if (g) {
      const rgb = theme === 'dark' ? '255,255,255' : '40,28,12';
      const boost = theme === 'dark' ? 1 : 0.8;
      const ink: Ink = (a) => `rgba(${rgb},${Math.min(1, a * boost).toFixed(3)})`;
      PAINTERS[material](g, mulberry32(seedOf(material)), ink, step / 2);
      const data = canvas.toDataURL('image/png');
      if (data.startsWith('data:image/png')) url = `url(${data})`;
    }
  } catch {
    url = 'none';
  }
  cache.set(key, url);
  return url;
}

/** Test hook: number of cached tiles. */
export const surfaceTileCacheSize = (): number => cache.size;
