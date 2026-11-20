// Theme context: M3 dark (default) / light / system, persisted in the writer's app settings.
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
import { loadSettings, saveSettings, type Appearance } from '../settings/app-settings.ts';
import { useRepository } from '../store/context.tsx';
import { darkColors, lightColors, type ColorRoles } from './m3-tokens.ts';

export interface Theme {
  dark: boolean;
  colors: ColorRoles;
}

export const darkTheme: Theme = { dark: true, colors: darkColors };
export const lightTheme: Theme = { dark: false, colors: lightColors };

interface ThemeState {
  theme: Theme;
  appearance: Appearance;
  setAppearance(a: Appearance): void;
}

const ThemeContext = createContext<ThemeState>({
  theme: darkTheme,
  appearance: 'dark',
  setAppearance: () => undefined,
});

export function ThemeProvider({ children }: { children: ReactNode }): ReactNode {
  const repo = useRepository();
  const system = useColorScheme();
  const [appearance, setLocal] = useState<Appearance>('dark');
  useEffect(() => {
    void loadSettings(repo).then((s) => setLocal(s.appearance));
  }, [repo]);
  const setAppearance = useCallback(
    (a: Appearance) => {
      setLocal(a);
      void saveSettings(repo, { appearance: a });
    },
    [repo],
  );
  const dark = appearance === 'system' ? system !== 'light' : appearance === 'dark';
  const value = useMemo(
    () => ({ theme: dark ? darkTheme : lightTheme, appearance, setAppearance }),
    [dark, appearance, setAppearance],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): Theme => useContext(ThemeContext).theme;

export function useAppearance(): [Appearance, (a: Appearance) => void] {
  const { appearance, setAppearance } = useContext(ThemeContext);
  return [appearance, setAppearance];
}

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
