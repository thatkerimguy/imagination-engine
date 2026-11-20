import { describe, expect, it } from 'vitest';
import { darkColors, withAlpha, type ColorRoles } from './m3-tokens.ts';
import { getThemeDef, isThemeId, THEME_IDS, THEMES } from './themes.ts';

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const PAIRS: [keyof ColorRoles, keyof ColorRoles][] = [
  ['onPrimary', 'primary'],
  ['onPrimaryContainer', 'primaryContainer'],
  ['onSecondary', 'secondary'],
  ['onSecondaryContainer', 'secondaryContainer'],
  ['onTertiary', 'tertiary'],
  ['onTertiaryContainer', 'tertiaryContainer'],
  ['onError', 'error'],
  ['onErrorContainer', 'errorContainer'],
  ['onSurface', 'surface'],
  ['onSurface', 'surfaceContainerHighest'],
  ['onSurfaceVariant', 'surfaceContainer'],
  ['onSurfaceVariant', 'surfaceContainerHigh'],
  ['primary', 'surface'],
  ['primary', 'surfaceContainerHigh'],
  ['tertiary', 'surfaceContainer'],
  ['onSurface', 'surfaceContainerLowest'],
  ['onSurfaceVariant', 'surface'],
  ['secondary', 'surface'],
];

describe('M3 colour schemes', () => {
  it('has 12 themes (6 night, 6 day) and 18 asserted pairs each', () => {
    expect(THEMES).toHaveLength(12);
    expect(THEMES.filter((t) => t.dark)).toHaveLength(6);
    expect(PAIRS).toHaveLength(18);
    expect(THEMES.map((t) => t.id)).toEqual([...THEME_IDS]);
  });

  it('keeps Editorial Teal as the system default', () => {
    expect(darkColors.surface).toBe('#101414');
    expect(isThemeId('warm-sepia')).toBe(true);
    expect(isThemeId('dark')).toBe(false);
    expect(getThemeDef('editorial-teal-light').dark).toBe(false);
  });

  for (const { id: name, colors: scheme } of THEMES) {
    it(`${name}: every role is #rrggbb`, () => {
      for (const v of Object.values(scheme)) expect(v).toMatch(/^#[0-9A-F]{6}$/i);
    });
    for (const [fg, bg] of PAIRS) {
      it(`${name}: ${fg} on ${bg} meets WCAG AA (4.5:1)`, () => {
        expect(contrast(scheme[fg], scheme[bg])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('withAlpha appends a clamped alpha byte', () => {
    expect(withAlpha('#000000', 0.12)).toBe('#0000001f');
    expect(withAlpha('#ffffff', 2)).toBe('#ffffffff');
  });
});
