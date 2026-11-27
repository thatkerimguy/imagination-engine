// Perceptual colour math for Book Visual DNA: OKLCH → sRGB with gamut clamping, WCAG 2.1
// contrast ratio, and APCA Lc (APCA-W3 0.0.98G constants). Pure and dependency-free.

export interface Oklch {
  /** Lightness 0..1. */
  l: number;
  /** Chroma 0..~0.37. */
  c: number;
  /** Hue in degrees. */
  h: number;
}

type Rgb = [number, number, number];

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** OKLCH → linear-light sRGB (may be out of gamut). */
function oklchToLinear({ l, c, h }: Oklch): Rgb {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l1 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m1 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s1 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l1 - 3.3077115913 * m1 + 0.2309699292 * s1,
    -1.2684380046 * l1 + 2.6097574011 * m1 - 0.3413193965 * s1,
    -0.0041960863 * l1 - 0.7034186147 * m1 + 1.707614701 * s1,
  ];
}

const inGamut = (rgb: Rgb): boolean => rgb.every((v) => v >= -2e-3 && v <= 1 + 2e-3);

const encode = (v: number): number =>
  v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;

/** Maps into the sRGB gamut by lowering chroma (hue and lightness kept), then gamma-encodes. */
export function oklchToSrgb(color: Oklch): Rgb {
  const col = { l: clamp01(color.l), c: Math.max(0, color.c), h: color.h };
  let lin = oklchToLinear(col);
  if (!inGamut(lin)) {
    let lo = 0;
    let hi = col.c;
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear({ ...col, c: mid }))) lo = mid;
      else hi = mid;
    }
    lin = oklchToLinear({ ...col, c: lo });
  }
  return lin.map((v) => clamp01(encode(clamp01(v)))) as Rgb;
}

export function srgbToHex(rgb: Rgb): string {
  return `#${rgb
    .map((v) =>
      Math.round(clamp01(v) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

export const oklchToHex = (color: Oklch): string => srgbToHex(oklchToSrgb(color));

export function hexToSrgb(hex: string): Rgb {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToSrgb(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio, 1..21. */
export function wcagContrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function apcaY(hex: string): number {
  const [r, g, b] = hexToSrgb(hex);
  const y = 0.2126729 * r ** 2.4 + 0.7151522 * g ** 2.4 + 0.072175 * b ** 2.4;
  return y < 0.022 ? y + (0.022 - y) ** 1.414 : y;
}

/** APCA lightness contrast Lc of `text` on `bg` (positive: dark on light, negative: light on dark). */
export function apcaContrast(text: string, bg: string): number {
  const yt = apcaY(text);
  const yb = apcaY(bg);
  if (Math.abs(yb - yt) < 0.0005) return 0;
  if (yb > yt) {
    const s = (yb ** 0.56 - yt ** 0.57) * 1.14;
    return s < 0.1 ? 0 : (s - 0.027) * 100;
  }
  const s = (yb ** 0.65 - yt ** 0.62) * 1.14;
  return s > -0.1 ? 0 : (s + 0.027) * 100;
}

export interface ContrastTarget {
  wcag: number;
  apca: number;
}

export const passes = (text: string, bg: string, t: ContrastTarget): boolean =>
  wcagContrast(text, bg) >= t.wcag && Math.abs(apcaContrast(text, bg)) >= t.apca;

/**
 * Steps `fg.l` by 0.02 toward 0.98 (dark theme) or 0.12 (light theme), easing chroma off past
 * L 0.88 / below L 0.22, until BOTH WCAG and APCA targets pass against `bgHex`. Returns the hex.
 * If the bound is reached without passing, pure white / black is returned (the DNA backgrounds
 * are clamped to very dark / very light lightness, so those always pass).
 */
export function ensureContrast(
  fg: Oklch,
  bgHex: string | readonly string[],
  minWcag: number,
  minApca: number,
  theme: 'dark' | 'light',
): string {
  const bgs = typeof bgHex === 'string' ? [bgHex] : bgHex;
  const target = { wcag: minWcag, apca: minApca };
  const dark = theme === 'dark';
  const c = { ...fg, l: clamp01(fg.l) };
  for (let i = 0; i < 60; i++) {
    const hex = oklchToHex(c);
    if (bgs.every((bg) => passes(hex, bg, target))) return hex;
    if (dark ? c.l >= 0.98 : c.l <= 0.12) break;
    c.l = dark ? Math.min(0.98, c.l + 0.02) : Math.max(0.12, c.l - 0.02);
    if (c.l > 0.88 || c.l < 0.22) c.c *= 0.85;
  }
  const last = oklchToHex(c);
  if (bgs.every((bg) => passes(last, bg, target))) return last;
  return dark ? '#ffffff' : '#000000';
}
