import { detectLocale, isLocale, type Locale } from '@ie/i18n';
import { isThemePreference, readPref, writePref, type ThemePreference } from '@ie/ui-kit';

export const TEXT_SIZES = ['small', 'medium', 'large'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const TEXT_SCALE: Readonly<Record<TextSize, number>> = {
  small: 0.9,
  medium: 1,
  large: 1.15,
};

export interface PlayerSettings {
  readonly locale: Locale;
  readonly theme: ThemePreference;
  readonly textSize: TextSize;
  readonly hud: boolean;
}

const KEYS = {
  locale: 'ie.player.locale',
  theme: 'ie.player.theme',
  textSize: 'ie.player.textSize',
  hud: 'ie.player.hud',
} as const;

function isTextSize(value: unknown): value is TextSize {
  return typeof value === 'string' && (TEXT_SIZES as readonly string[]).includes(value);
}

/** Reads per-device settings. `?hud` in the URL forces the performance overlay on. */
export function loadSettings(search: string = location.search): PlayerSettings {
  const locale = readPref(KEYS.locale);
  const theme = readPref(KEYS.theme);
  const textSize = readPref(KEYS.textSize);
  return {
    locale: isLocale(locale) ? locale : detectLocale(),
    theme: isThemePreference(theme) ? theme : 'system',
    textSize: isTextSize(textSize) ? textSize : 'medium',
    hud: new URLSearchParams(search).has('hud') || readPref(KEYS.hud) === 'on',
  };
}

export function saveSettings(settings: PlayerSettings): void {
  writePref(KEYS.locale, settings.locale);
  writePref(KEYS.theme, settings.theme);
  writePref(KEYS.textSize, settings.textSize);
  writePref(KEYS.hud, settings.hud ? 'on' : 'off');
}
