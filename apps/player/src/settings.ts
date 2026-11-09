import { detectLocale, isLocale, type Locale } from '@ie/i18n';
import { TEXT_SPEEDS, type TextSpeed } from '@ie/present';
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
  readonly textSpeed: TextSpeed;
  /** Off: timed choices wait for the reader. */
  readonly timers: boolean;
  readonly hud: boolean;
}

const KEYS = {
  locale: 'ie.player.locale',
  theme: 'ie.player.theme',
  textSize: 'ie.player.textSize',
  textSpeed: 'ie.player.textSpeed',
  timers: 'ie.player.timers',
  hud: 'ie.player.hud',
} as const;

function oneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

/** Reads per-device settings. `?hud` in the URL forces the performance overlay on. */
export function loadSettings(search: string = location.search): PlayerSettings {
  const locale = readPref(KEYS.locale);
  const theme = readPref(KEYS.theme);
  const textSize = readPref(KEYS.textSize);
  const textSpeed = readPref(KEYS.textSpeed);
  return {
    locale: isLocale(locale) ? locale : detectLocale(),
    theme: isThemePreference(theme) ? theme : 'system',
    textSize: oneOf(TEXT_SIZES, textSize) ? textSize : 'medium',
    textSpeed: oneOf(TEXT_SPEEDS, textSpeed) ? textSpeed : 'normal',
    timers: readPref(KEYS.timers) !== 'off',
    hud: new URLSearchParams(search).has('hud') || readPref(KEYS.hud) === 'on',
  };
}

export function saveSettings(settings: PlayerSettings): void {
  writePref(KEYS.locale, settings.locale);
  writePref(KEYS.theme, settings.theme);
  writePref(KEYS.textSize, settings.textSize);
  writePref(KEYS.textSpeed, settings.textSpeed);
  writePref(KEYS.timers, settings.timers ? 'on' : 'off');
  writePref(KEYS.hud, settings.hud ? 'on' : 'off');
}
