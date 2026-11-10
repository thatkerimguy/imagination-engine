import { detectLocale, isLocale, type Locale } from '@ie/i18n';
import { TEXT_SPEEDS, type TextSpeed } from '@ie/present';
import { isThemePreference, readPref, writePref, type ThemePreference } from '@ie/ui-kit';

export const TEXT_SIZES = ['small', 'medium', 'large'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

/** Help in rhythm fights: wider timing, can't lose, or the fight plays itself. */
export const FIGHT_ASSISTS = ['off', 'wide', 'noFail', 'auto'] as const;
export type FightAssist = (typeof FIGHT_ASSISTS)[number];

/** Accessibility (ADR 0022): motion, contrast, line spacing and plainer letters. */
export const MOTIONS = ['system', 'reduce', 'full'] as const;
export const CONTRASTS = ['normal', 'high'] as const;
export const SPACINGS = ['normal', 'relaxed', 'wide'] as const;
export const LETTERS = ['book', 'plain'] as const;
export const SPACING_SCALE: Readonly<Record<(typeof SPACINGS)[number], number>> = {
  normal: 1,
  relaxed: 1.15,
  wide: 1.3,
};

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
  /** Off: every story uses the reader's own Paper or Night, not the look its author chose. */
  readonly storyLook: boolean;
  readonly hud: boolean;
  readonly fightAssist: FightAssist;
  /** Short vibrations on hits in fights, where the device has them. */
  readonly haptics: boolean;
  /** 0..1 per bus. */
  readonly volumes: Readonly<Record<VolumeBus, number>>;
  readonly motion: (typeof MOTIONS)[number];
  readonly contrast: (typeof CONTRASTS)[number];
  readonly spacing: (typeof SPACINGS)[number];
  /** Plain: the sans-serif for prose, easier for some readers (dyslexia). */
  readonly letters: (typeof LETTERS)[number];
}

/** The accessibility settings, as one patch. */
export type AccessSettings = Pick<PlayerSettings, 'motion' | 'contrast' | 'spacing' | 'letters'>;

const KEYS = {
  locale: 'ie.player.locale',
  theme: 'ie.player.theme',
  textSize: 'ie.player.textSize',
  textSpeed: 'ie.player.textSpeed',
  timers: 'ie.player.timers',
  storyLook: 'ie.player.storyLook',
  hud: 'ie.player.hud',
  fightAssist: 'ie.player.fightAssist',
  haptics: 'ie.player.haptics',
  motion: 'ie.player.motion',
  contrast: 'ie.player.contrast',
  spacing: 'ie.player.spacing',
  letters: 'ie.player.letters',
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
  const motion = readPref(KEYS.motion);
  const contrast = readPref(KEYS.contrast);
  const spacing = readPref(KEYS.spacing);
  const letters = readPref(KEYS.letters);
  return {
    motion: oneOf(MOTIONS, motion) ? motion : 'system',
    contrast: oneOf(CONTRASTS, contrast) ? contrast : 'normal',
    spacing: oneOf(SPACINGS, spacing) ? spacing : 'normal',
    letters: oneOf(LETTERS, letters) ? letters : 'book',
    locale: isLocale(locale) ? locale : detectLocale(),
    theme: isThemePreference(theme) ? theme : 'system',
    textSize: oneOf(TEXT_SIZES, textSize) ? textSize : 'medium',
    textSpeed: oneOf(TEXT_SPEEDS, textSpeed) ? textSpeed : 'normal',
    timers: readPref(KEYS.timers) !== 'off',
    storyLook: readPref(KEYS.storyLook) !== 'off',
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
  writePref(KEYS.storyLook, settings.storyLook ? 'on' : 'off');
  writePref(KEYS.hud, settings.hud ? 'on' : 'off');
  writePref(KEYS.fightAssist, settings.fightAssist);
  writePref(KEYS.haptics, settings.haptics ? 'on' : 'off');
  writePref(KEYS.motion, settings.motion);
  writePref(KEYS.contrast, settings.contrast);
  writePref(KEYS.spacing, settings.spacing);
  writePref(KEYS.letters, settings.letters);
  for (const bus of VOLUME_BUSES)
    writePref(`ie.player.volume.${bus}`, String(Math.round(settings.volumes[bus] * 100) / 100));
}
