import { describe, expect, it } from 'vitest';
import { mix, type FolioColors } from './palette.ts';
import { getThemeDef, isThemeId, THEME_IDS, THEMES } from './themes.ts';
import { radius, space, withAlpha } from './tokens.ts';

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Foreground / background pairs that carry text or icons somewhere in the writer. */
const PAIRS: [keyof FolioColors, keyof FolioColors][] = [
  ['ink', 'canvas'],
  ['ink', 'surface'],
  ['ink', 'surfaceElevated'],
  ['ink', 'surfaceTint'],
  ['ink', 'accentSoft'],
  ['inkSecondary', 'canvas'],
  ['inkSecondary', 'surface'],
  ['inkSecondary', 'surfaceElevated'],
  ['inkSecondary', 'surfaceTint'],
  ['inkMuted', 'canvas'],
  ['inkMuted', 'surface'],
  ['accent', 'canvas'],
  ['accent', 'surface'],
  ['accent', 'surfaceElevated'],
  ['accent', 'surfaceTint'],
  ['accent', 'accentSoft'],
  ['onAccent', 'accent'],
  ['warm', 'canvas'],
  ['warm', 'surface'],
  ['danger', 'canvas'],
  ['danger', 'dangerSoft'],
  ['success', 'canvas'],
];

describe('Folio themes', () => {
  it('has 12 themes (6 night, 6 day)', () => {
    expect(THEMES).toHaveLength(12);
    expect(THEMES.filter((t) => t.dark)).toHaveLength(6);
    expect(THEMES.map((t) => t.id)).toEqual([...THEME_IDS]);
  });

  it('keeps Editorial Teal as the system default and validates ids', () => {
    expect(getThemeDef('editorial-teal-dark').colors.canvas).toBe('#101414');
    expect(isThemeId('warm-sepia')).toBe(true);
    expect(isThemeId('dark')).toBe(false);
    expect(getThemeDef('editorial-teal-light').dark).toBe(false);
  });

  for (const { id, colors } of THEMES) {
    it(`${id}: every role is #RRGGBB`, () => {
      for (const v of Object.values(colors)) expect(v).toMatch(/^#[0-9A-F]{6}$/i);
    });
    for (const [fg, bg] of PAIRS) {
      it(`${id}: ${fg} on ${bg} meets WCAG AA (4.5:1)`, () => {
        expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
      });
    }
    it(`${id}: hairline is a whisper (1.1–1.6:1 on canvas)`, () => {
      const c = contrast(colors.hairline, colors.canvas);
      expect(c).toBeGreaterThan(1.1);
      expect(c).toBeLessThan(1.6);
    });
  }
});

describe('Folio tokens', () => {
  it('uses the specified radii and spacing scale', () => {
    expect(radius).toMatchObject({ xs: 6, sm: 10, md: 14, sheet: 20, pill: 999 });
    expect([space.xxs, space.xs, space.sm, space.md, space.lg, space.xl, space.xxl]).toEqual([
      4, 8, 12, 16, 20, 24, 32,
    ]);
  });

  it('mix blends toward the background; withAlpha appends a clamped byte', () => {
    expect(mix('#FFFFFF', '#000000', 0.5)).toBe('#808080');
    expect(mix('#123456', '#ABCDEF', 1)).toBe('#123456');
    expect(withAlpha('#000000', 0.12)).toBe('#0000001f');
    expect(withAlpha('#ffffff', 2)).toBe('#ffffffff');
  });
});
