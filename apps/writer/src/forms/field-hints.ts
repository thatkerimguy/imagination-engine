// Pure display helpers for form controls. No react / react-native imports (node-testable).

/** "1–3", "0.5–8 s", "0–1": the allowed range plus unit, for supporting text. */
export function rangeHint(f: { min: number; max: number; unit?: string }): string {
  return `${f.min}–${f.max}${f.unit ? ` ${f.unit}` : ''}`;
}

/** Parses a typed number (accepts a decimal comma); null when empty or not finite. */
export function parseNumberInput(text: string): number | null {
  if (text.trim() === '') return null;
  const n = Number(text.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export const isHexColor = (v: string): boolean => HEX.test(v);

/** Black or white, whichever reads better on the given #rrggbb swatch. */
export function readableOn(hex: string): '#000000' | '#ffffff' {
  if (!HEX.test(hex)) return '#ffffff';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * (r ?? 0) + 0.587 * (g ?? 0) + 0.114 * (b ?? 0) > 150 ? '#000000' : '#ffffff';
}
