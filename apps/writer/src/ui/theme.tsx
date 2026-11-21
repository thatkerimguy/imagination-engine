// Theme + writer-prefs context. The colour scheme is one of the 12 curated Folio themes, or
// 'system': on Android 12+ the phone's Material You wallpaper palette (soft or exact), else
// Editorial Teal night/day following the OS. Prefs persist under `prefs/writer-ui`; the Phase 2
// `appearance` setting is migrated on first load.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  AppState,
  StyleSheet,
  useColorScheme,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useRepository } from '../store/context.tsx';
import {
  DEFAULT_WRITER_PREFS,
  loadWriterPrefs,
  saveWriterPrefs,
  type ThemeChoice,
  type WriterPrefs,
} from '../store/writer-prefs.ts';
import { buildMaterialYouTheme, type WallpaperPalette } from './material-you.ts';
import { readWallpaperPalette } from './material-you-native.ts';
import type { FolioColors } from './palette.ts';
import { DEFAULT_DARK, DEFAULT_LIGHT, getThemeDef, THEMES, type ThemeId } from './themes.ts';

export interface Theme {
  id: ThemeId;
  label: string;
  dark: boolean;
  /** Folio colour roles. */
  colors: FolioColors;
}

/** One frozen Theme object per scheme, so makeStyles can cache by identity. */
const THEME_OBJECTS = new Map<ThemeId, Theme>(THEMES.map((t) => [t.id, { ...t }]));
export const themeFor = (id: ThemeId): Theme =>
  THEME_OBJECTS.get(id) ?? THEME_OBJECTS.get(DEFAULT_DARK)!;
export const darkTheme: Theme = themeFor(DEFAULT_DARK);
export const lightTheme: Theme = themeFor(DEFAULT_LIGHT);

export function resolveTheme(choice: ThemeChoice, system: 'light' | 'dark' | null | undefined) {
  if (choice !== 'system') return themeFor(getThemeDef(choice).id);
  return system === 'light' ? lightTheme : darkTheme;
}

export interface MaterialYouSwatch {
  canvas: string;
  surface: string;
  accent: string;
}

interface ThemeState {
  theme: Theme;
  /** True while 'system' is showing the phone's wallpaper palette. */
  materialYouActive: boolean;
  /** Live wallpaper colours for the Appearance preview dots (null when not active). */
  materialYouSwatch: MaterialYouSwatch | null;
  prefs: WriterPrefs;
  /** True once stored prefs have loaded (before that, defaults are shown). */
  prefsReady: boolean;
  updatePrefs(patch: Partial<WriterPrefs>): void;
}

const ThemeContext = createContext<ThemeState>({
  theme: darkTheme,
  materialYouActive: false,
  materialYouSwatch: null,
  prefs: DEFAULT_WRITER_PREFS,
  prefsReady: false,
  updatePrefs: () => undefined,
});

export function ThemeProvider({ children }: { children: ReactNode }): ReactNode {
  const repo = useRepository();
  const system = useColorScheme();
  const [prefs, setPrefs] = useState<WriterPrefs>(DEFAULT_WRITER_PREFS);
  const [prefsReady, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    void loadWriterPrefs(repo).then((p) => {
      if (!live) return;
      setPrefs(p);
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [repo]);
  const updatePrefs = useCallback(
    (patch: Partial<WriterPrefs>) => {
      setPrefs((p) => ({ ...p, ...patch }));
      void saveWriterPrefs(repo, patch).then(setPrefs);
    },
    [repo],
  );
  const followSystem = prefs.themeId === 'system';
  const isDark = system !== 'light';
  const wallpaper = useWallpaperPalette(followSystem, isDark);
  const style = prefs.materialYouStyle;
  const fallback = resolveTheme(prefs.themeId, system);
  // One Theme object per (palette, mode, style) so makeStyles' identity cache stays small.
  const materialTheme = useMemo<Theme | null>(() => {
    if (!followSystem || !wallpaper) return null;
    const colors = buildMaterialYouTheme(wallpaper, isDark ? 'dark' : 'light', style);
    return { id: fallback.id, label: 'Material You', dark: isDark, colors };
  }, [followSystem, wallpaper, isDark, style, fallback.id]);
  const theme = materialTheme ?? fallback;
  const value = useMemo<ThemeState>(
    () => ({
      theme,
      materialYouActive: materialTheme !== null,
      materialYouSwatch: materialTheme
        ? {
            canvas: materialTheme.colors.canvas,
            surface: materialTheme.colors.surface,
            accent: materialTheme.colors.accent,
          }
        : null,
      prefs,
      prefsReady,
      updatePrefs,
    }),
    [theme, materialTheme, prefs, prefsReady, updatePrefs],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * The wallpaper palette while following the system theme: read on mount, on light/dark changes
 * and whenever the app returns to the foreground (so a new wallpaper applies on resume).
 */
function useWallpaperPalette(enabled: boolean, isDark: boolean): WallpaperPalette | null {
  const [palette, setPalette] = useState<WallpaperPalette | null>(null);
  useEffect(() => {
    if (!enabled) {
      setPalette(null);
      return;
    }
    let live = true;
    const read = (): void => {
      void readWallpaperPalette(isDark).then((p) => {
        if (!live) return;
        // Keep the previous object when nothing changed (no theme churn on every resume).
        setPalette((prev) => (prev && p && JSON.stringify(prev) === JSON.stringify(p) ? prev : p));
      });
    };
    read();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && read());
    return () => {
      live = false;
      sub.remove();
    };
  }, [enabled, isDark]);
  return palette;
}

export const useTheme = (): Theme => useContext(ThemeContext).theme;

/** Renders `children` with a fixed theme (e.g. the Live Preview theater); prefs stay shared. */
export function ThemeOverride({
  theme,
  children,
}: {
  theme: Theme;
  children: ReactNode;
}): ReactNode {
  const outer = useContext(ThemeContext);
  const value = useMemo(() => ({ ...outer, theme }), [outer, theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Material You status for the Appearance screen. */
export function useMaterialYou(): { active: boolean; swatch: MaterialYouSwatch | null } {
  const { materialYouActive, materialYouSwatch } = useContext(ThemeContext);
  return { active: materialYouActive, swatch: materialYouSwatch };
}

/** Writer UI prefs and a persisting updater (merges a partial patch). */
export function useWriterPrefs(): [WriterPrefs, (patch: Partial<WriterPrefs>) => void] {
  const { prefs, updatePrefs } = useContext(ThemeContext);
  return [prefs, updatePrefs];
}

export const usePrefsReady = (): boolean => useContext(ThemeContext).prefsReady;

/**
 * Themed StyleSheet factory: `const useStyles = makeStyles((t) => ({ ... }))` at module level,
 * then `const s = useStyles()` in the component. One StyleSheet per scheme, cached.
 */
type NamedStyles<T> = { [K in keyof T]: ViewStyle | TextStyle | ImageStyle };

export function makeStyles<T extends NamedStyles<T>>(build: (theme: Theme) => T): () => T {
  const cache = new Map<Theme, T>();
  return function useStyles(): T {
    const theme = useTheme();
    let styles = cache.get(theme);
    if (!styles) {
      styles = StyleSheet.create(build(theme));
      cache.set(theme, styles);
    }
    return styles;
  };
}
