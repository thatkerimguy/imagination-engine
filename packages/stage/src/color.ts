import type { Rgb } from './actors.ts';

/**
 * A CSS colour (#hex, rgb(), rgb with slash alpha) as 0..1 floats, for theme tokens read with
 * getComputedStyle. Unknown syntax gives `fallback`.
 */
export function parseCssColor(value: string, fallback: Rgb = [0.5, 0.5, 0.5]): Rgb {
  const v = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as unknown as Rgb;
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v);
  if (rgb) return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];
  return fallback;
}
