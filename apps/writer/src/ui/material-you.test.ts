import { describe, expect, it } from 'vitest';
import type { FolioColors } from './palette.ts';
import {
  buildMaterialYouTheme,
  contrast,
  parseWallpaperPalette,
  type MaterialYouMode,
  type MaterialYouStyle,
  type WallpaperPalette,
} from './material-you.ts';

/** Tonal palettes shaped like Android's system_neutral1 / accent1 / accent3 reads per mode. */
const WALLPAPERS: Record<string, Record<MaterialYouMode, WallpaperPalette>> = {
  'neon magenta': {
    dark: {
      canvas: '#3A0030',
      surface: '#55004A',
      surfaceElevated: '#700062',
      accent: '#FF00E6',
      warm: '#FF3D7F',
    },
    light: {
      canvas: '#FFD6F6',
      surface: '#FFB8EF',
      surfaceElevated: '#FFEFFB',
      accent: '#FF00E6',
      warm: '#FF3D7F',
    },
  },
  'bright yellow': {
    dark: {
      canvas: '#2B2600',
      surface: '#3D3600',
      surfaceElevated: '#524900',
      accent: '#FFE600',
      warm: '#FFB300',
    },
    light: {
      canvas: '#FFFBD0',
      surface: '#FFF59A',
      surfaceElevated: '#FFFFFF',
      accent: '#FFE600',
      warm: '#FFB300',
    },
  },
  'pitch black': {
    dark: {
      canvas: '#000000',
      surface: '#000000',
      surfaceElevated: '#0A0A0A',
      accent: '#1A1A1A',
      warm: '#111111',
    },
    light: {
      canvas: '#F2F2F2',
      surface: '#E6E6E6',
      surfaceElevated: '#FFFFFF',
      accent: '#000000',
      warm: '#000000',
    },
  },
  'pure white': {
    dark: {
      canvas: '#1C1C1C',
      surface: '#2A2A2A',
      surfaceElevated: '#3A3A3A',
      accent: '#FFFFFF',
      warm: '#FFFFFF',
    },
    light: {
      canvas: '#FFFFFF',
      surface: '#FFFFFF',
      surfaceElevated: '#FFFFFF',
      accent: '#F5F5F5',
      warm: '#FAFAFA',
    },
  },
  'pastel sage': {
    dark: {
      canvas: '#1A1F1A',
      surface: '#262C26',
      surfaceElevated: '#333A33',
      accent: '#B5D6B2',
      warm: '#E0C9A6',
    },
    light: {
      canvas: '#F5FAF3',
      surface: '#E8F0E6',
      surfaceElevated: '#FFFFFF',
      accent: '#B5D6B2',
      warm: '#E0C9A6',
    },
  },
};

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

const chroma = (hex: string): number => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return Math.max(...c) - Math.min(...c);
};

const MODES: MaterialYouMode[] = ['dark', 'light'];
const STYLES: MaterialYouStyle[] = ['soft', 'exact'];

describe('buildMaterialYouTheme', () => {
  for (const [name, byMode] of Object.entries(WALLPAPERS)) {
    for (const mode of MODES) {
      for (const style of STYLES) {
        it(`${name} · ${mode} · ${style}: every Folio pair clears WCAG AA`, () => {
          const c = buildMaterialYouTheme(byMode[mode], mode, style);
          for (const v of Object.values(c)) expect(v).toMatch(/^#[0-9A-F]{6}$/);
          for (const [fg, bg] of PAIRS) {
            expect(contrast(c[fg], c[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
          }
        });
      }
    }
  }

  it("'exact' keeps the wallpaper surfaces Android reports", () => {
    for (const mode of MODES) {
      const raw = WALLPAPERS['pastel sage']![mode];
      const c = buildMaterialYouTheme(raw, mode, 'exact');
      expect([c.canvas, c.surface, c.surfaceElevated]).toEqual([
        raw.canvas,
        raw.surface,
        raw.surfaceElevated,
      ]);
    }
    const magenta = WALLPAPERS['neon magenta']!.dark;
    expect(buildMaterialYouTheme(magenta, 'dark', 'exact').canvas).toBe(magenta.canvas);
  });

  it("'soft' visibly moderates loud wallpaper chroma", () => {
    for (const name of ['neon magenta', 'bright yellow']) {
      for (const mode of MODES) {
        const raw = WALLPAPERS[name]![mode];
        const exact = buildMaterialYouTheme(raw, mode, 'exact');
        const soft = buildMaterialYouTheme(raw, mode, 'soft');
        expect(chroma(soft.canvas)).toBeLessThan(chroma(exact.canvas) * 0.8);
        expect(chroma(soft.surface)).toBeLessThan(chroma(exact.surface) * 0.8);
        expect(soft.canvas).not.toBe(raw.canvas);
      }
    }
  });

  it('rescues a palette whose surfaces fight the mode', () => {
    const glare = {
      canvas: '#FFFFFF',
      surface: '#FFFF00',
      surfaceElevated: '#00FFFF',
      accent: '#FFFFFF',
      warm: '#FFFF00',
    };
    const c = buildMaterialYouTheme(glare, 'dark', 'exact');
    for (const [fg, bg] of PAIRS) expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('parseWallpaperPalette', () => {
  it('accepts a full native map and rejects partial or malformed ones', () => {
    const ok = WALLPAPERS['pastel sage']!.dark;
    expect(parseWallpaperPalette({ ...ok, neutral: '#222222' })).toEqual(ok);
    expect(parseWallpaperPalette({ ...ok, accent: 'teal' })).toBeNull();
    expect(parseWallpaperPalette({ canvas: '#000000' })).toBeNull();
    expect(parseWallpaperPalette(null)).toBeNull();
  });
});
