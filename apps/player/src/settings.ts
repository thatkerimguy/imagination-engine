import { detectLocale, isLocale, type Locale } from '@ie/i18n';
import { TEXT_SPEEDS, type TextSpeed } from '@ie/present';
import { isThemePreference, readPref, writePref, type ThemePreference } from '@ie/ui-kit';

export const TEXT_SIZES = ['small', 'medium', 'large'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

/** Help in rhythm fights: wider timing, can't lose, or the fight plays itself. */
export const FIGHT_ASSISTS = ['off', 'wide', 'noFail', 'auto'] as const;
export type FightAssist = (typeof FIGHT_ASSISTS)[number];

export const TEXT_SCALE: Readonly<Record<TextSize, number>> = {
  small: 0.9,
  medium: 1,
  large: 1.15,
};

/** The volumes a reader can set; `ui` stays at full (it is the menu's own clicks). */
export const VOLUME_BUSES = ['master', 'music', 'ambience', 'sfx', 'voice'] as const;
export type VolumeBus = (typeof VOLUME_BUSES)[number];

export interface PlayerSettings {
  readonly locale: Locale;
  readonly theme: ThemePreference;
  readonly textSize: TextSize;
  readonly textSpeed: TextSpeed;
  /** Off: timed choices wait for the reader. */
  readonly timers: boolean;
  readonly hud: boolean;
  readonly fightAssist: FightAssist;
  /** Short vibrations on hits in fights, where the device has them. */
  readonly haptics: boolean;
  /** 0..1 per bus. */
  readonly volumes: Readonly<Record<VolumeBus, number>>;
}

const KEYS = {
  locale: 'ie.player.locale',
  theme: 'ie.player.theme',
  textSize: 'ie.player.textSize',
  textSpeed: 'ie.player.textSpeed',
  timers: 'ie.player.timers',
  hud: 'ie.player.hud',
  fightAssist: 'ie.player.fightAssist',
  haptics: 'ie.player.haptics',
} as const;

function readVolume(bus: VolumeBus): number {
  const v = Number(readPref(`ie.player.volume.${bus}`) ?? '1');
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
}

function oneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

/** Reads per-device settings. `?hud` in the URL forces the performance overlay on. */
export function loadSettings(search: string = location.search): PlayerSettings {
  const locale = readPref(KEYS.locale);
  const theme = readPref(KEYS.theme);
  const textSize = readPref(KEYS.textSize);
  const textSpeed = readPref(KEYS.textSpeed);
  const fightAssist = readPref(KEYS.fightAssist);
  return {
    locale: isLocale(locale) ? locale : detectLocale(),
    theme: isThemePreference(theme) ? theme : 'system',
    textSize: oneOf(TEXT_SIZES, textSize) ? textSize : 'medium',
    textSpeed: oneOf(TEXT_SPEEDS, textSpeed) ? textSpeed : 'normal',
    timers: readPref(KEYS.timers) !== 'off',
    hud: new URLSearchParams(search).has('hud') || readPref(KEYS.hud) === 'on',
    fightAssist: oneOf(FIGHT_ASSISTS, fightAssist) ? fightAssist : 'off',
    haptics: readPref(KEYS.haptics) !== 'off',
    volumes: Object.fromEntries(VOLUME_BUSES.map((b) => [b, readVolume(b)])) as Record<
      VolumeBus,
      number
    >,
  };
}

export function saveSettings(settings: PlayerSettings): void {
  writePref(KEYS.locale, settings.locale);
  writePref(KEYS.theme, settings.theme);
  writePref(KEYS.textSize, settings.textSize);
  writePref(KEYS.textSpeed, settings.textSpeed);
  writePref(KEYS.timers, settings.timers ? 'on' : 'off');
  writePref(KEYS.hud, settings.hud ? 'on' : 'off');
  writePref(KEYS.fightAssist, settings.fightAssist);
  writePref(KEYS.haptics, settings.haptics ? 'on' : 'off');
  for (const bus of VOLUME_BUSES)
    writePref(`ie.player.volume.${bus}`, String(Math.round(settings.volumes[bus] * 100) / 100));
}
