export const THEMES = ['paper', 'night'] as const;
export type Theme = (typeof THEMES)[number];
export type ThemePreference = Theme | 'system';
export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'paper', 'night'];

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'paper' || value === 'night';
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): Theme {
  if (preference === 'system') return prefersDark ? 'night' : 'paper';
  return preference;
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches;
}

/** Background colours per theme, mirrored from tokens.css for the browser's theme-color. */
export const THEME_BACKGROUND: Readonly<Record<Theme, string>> = {
  paper: '#f4f1ea',
  night: '#0f0f10',
};

/** Sets `data-theme` on <html> and updates the browser chrome colour. Returns the resolved theme. */
export function applyTheme(
  preference: ThemePreference,
  root: HTMLElement = document.documentElement,
): Theme {
  const theme = resolveTheme(preference, systemPrefersDark());
  root.dataset.theme = theme;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  meta.content = THEME_BACKGROUND[theme];
  return theme;
}

/** Calls back when the operating system switches between light and dark. */
export function watchSystemTheme(onChange: (prefersDark: boolean) => void): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const query = matchMedia(DARK_QUERY);
  const listener = (event: MediaQueryListEvent) => onChange(event.matches);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
