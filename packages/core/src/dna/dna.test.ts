import { describe, expect, it } from 'vitest';
import {
  apcaContrast,
  BODY_TARGET,
  DNA_ARCHETYPE_IDS,
  DNA_ARCHETYPES,
  oklchToHex,
  oklchToSrgb,
  parseVisualDna,
  resolveVisualDna,
  UI_TARGET,
  wcagContrast,
  type BookVisualDna,
  type DnaTheme,
} from './index.ts';

const THEMES: DnaTheme[] = ['dark', 'light'];
const BODY = ['--dna-ink', '--dna-muted'] as const;
const UI = ['--dna-accent', '--dna-accent-2', '--dna-warn', '--dna-ok'] as const;

function expectSafe(dna: BookVisualDna, theme: DnaTheme): void {
  const r = resolveVisualDna(dna, theme);
  const high = dna.palette.contrastMode === 'high';
  for (const bgKey of ['--dna-bg', '--dna-surface', '--dna-surface-alt'] as const) {
    const bg = r.colors[bgKey];
    for (const k of BODY) {
      expect(wcagContrast(r.colors[k], bg)).toBeGreaterThanOrEqual(high ? 7 : BODY_TARGET.wcag);
      expect(Math.abs(apcaContrast(r.colors[k], bg))).toBeGreaterThanOrEqual(BODY_TARGET.apca);
    }
    for (const k of UI) {
      expect(wcagContrast(r.colors[k], bg)).toBeGreaterThanOrEqual(UI_TARGET.wcag);
      expect(Math.abs(apcaContrast(r.colors[k], bg))).toBeGreaterThanOrEqual(UI_TARGET.apca);
    }
  }
}

describe('colour math', () => {
  it('converts OKLCH anchors to sRGB', () => {
    expect(oklchToHex({ l: 1, c: 0, h: 0 })).toBe('#ffffff');
    expect(oklchToHex({ l: 0, c: 0, h: 0 })).toBe('#000000');
    // oklch(62.8% 0.2577 29.23) is sRGB red.
    expect(oklchToHex({ l: 0.628, c: 0.2577, h: 29.23 })).toBe('#ff0000');
  });

  it('clamps out-of-gamut chroma into sRGB', () => {
    for (const v of oklchToSrgb({ l: 0.7, c: 0.5, h: 145 })) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('matches the WCAG and APCA reference values', () => {
    expect(wcagContrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(wcagContrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
    expect(apcaContrast('#000000', '#ffffff')).toBeCloseTo(106.04, 0);
    expect(apcaContrast('#ffffff', '#000000')).toBeCloseTo(-107.88, 0);
    expect(apcaContrast('#888888', '#ffffff')).toBeCloseTo(63.06, 0);
  });
});

describe('resolveVisualDna', () => {
  it('ships six archetypes that all validate', () => {
    expect(DNA_ARCHETYPE_IDS).toHaveLength(6);
    for (const id of DNA_ARCHETYPE_IDS) expect(parseVisualDna(DNA_ARCHETYPES[id]).ok).toBe(true);
  });

  it('keeps every archetype contrast-safe in dark and light', () => {
    for (const id of DNA_ARCHETYPE_IDS) for (const t of THEMES) expectSafe(DNA_ARCHETYPES[id], t);
  });

  it('gives distinct accents per archetype', () => {
    const accents = DNA_ARCHETYPE_IDS.map(
      (id) => resolveVisualDna(DNA_ARCHETYPES[id], 'dark').colors['--dna-accent'],
    );
    expect(new Set(accents).size).toBe(accents.length);
  });

  it('never fails contrast across a fuzz of extreme hues, chromas and warmth', () => {
    const base = DNA_ARCHETYPES['editorial-minimal'];
    let cases = 0;
    for (let hue = 0; hue < 360; hue += 15) {
      for (const chroma of [0, 0.05, 0.12, 0.2, 0.3, 0.37]) {
        for (const warmth of [-1, -0.3, 0, 0.5, 1]) {
          for (const contrastMode of ['balanced', 'high'] as const) {
            const dna: BookVisualDna = {
              ...base,
              palette: { hue, chroma, warmth, secondaryHue: (hue + 137) % 360, contrastMode },
            };
            for (const t of THEMES) {
              expectSafe(dna, t);
              cases++;
            }
          }
        }
      }
    }
    expect(cases).toBe(24 * 6 * 5 * 2 * 2);
  });

  it('emits typography, shape and motion tokens', () => {
    const r = resolveVisualDna(DNA_ARCHETYPES['classified-dossier'], 'light');
    expect(r.tokens['--dna-font-diegetic']).toMatch(/Courier/);
    expect(r.tokens['--dna-tempo']).toBe('1');
    expect(r.colors['--dna-surface-alt']).toMatch(/^#[0-9a-f]{6}$/);
    expect(r.tokens['--dna-radius']).toBe('2px');
    expect(r.tokens['--dna-dur']).toMatch(/^\d+ms$/);
    expect(resolveVisualDna(DNA_ARCHETYPES['editorial-minimal'], 'dark').theme).toBe('dark');
  });

  it('rejects malformed DNA', () => {
    const bad = { ...DNA_ARCHETYPES['noir-rain'], palette: { hue: 'red' } };
    expect(parseVisualDna(bad).ok).toBe(false);
  });
});
