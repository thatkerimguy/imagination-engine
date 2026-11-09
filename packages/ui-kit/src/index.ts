export { readPref, removePref, writePref } from './prefs.ts';
export {
  THEMES,
  THEME_BACKGROUND,
  THEME_PREFERENCES,
  applyTheme,
  isThemePreference,
  resolveTheme,
  systemPrefersDark,
  watchSystemTheme,
  type Theme,
  type ThemePreference,
} from './theme.ts';
