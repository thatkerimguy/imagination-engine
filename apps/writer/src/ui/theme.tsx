// Theme + writer-prefs context. The colour scheme is one of the 12 curated Folio themes, or
// 'system' (Editorial Teal night/day following the OS). Prefs persist under `prefs/writer-ui`;
// the Phase 2 `appearance` setting is migrated on first load.
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

interface ThemeState {
  theme: Theme;
  prefs: WriterPrefs;
  /** True once stored prefs have loaded (before that, defaults are shown). */
  prefsReady: boolean;
  updatePrefs(patch: Partial<WriterPrefs>): void;
}

const ThemeContext = createContext<ThemeState>({
  theme: darkTheme,
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
  const theme = resolveTheme(prefs.themeId, system);
  const value = useMemo(
    () => ({ theme, prefs, prefsReady, updatePrefs }),
    [theme, prefs, prefsReady, updatePrefs],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): Theme => useContext(ThemeContext).theme;

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
