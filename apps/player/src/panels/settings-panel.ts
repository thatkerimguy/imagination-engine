import { LOCALES, LOCALE_INFO, type Translator } from '@ie/i18n';
import { TEXT_SPEEDS } from '@ie/present';
import { THEME_PREFERENCES } from '@ie/ui-kit';
import { h, segmented } from '../dom.ts';
import type { MessageKey } from '../messages.ts';
import {
  FIGHT_ASSISTS,
  TEXT_SIZES,
  VOLUME_BUSES,
  type PlayerSettings,
  type VolumeBus,
} from '../settings.ts';

type Run = (actionId: string, params: unknown) => void;

function field(label: string, control: HTMLElement): HTMLElement {
  return h('div', { class: 'ie-field' }, h('span', { class: 'ie-label' }, label), control);
}

function onOff(
  t: Translator<MessageKey>,
  value: boolean,
  onPick: (on: boolean) => void,
  label: string,
): HTMLElement {
  return segmented(
    [
      { value: 'off', label: t('settings.off') },
      { value: 'on', label: t('settings.on') },
    ],
    value ? 'on' : 'off',
    (v) => onPick(v === 'on'),
    label,
  );
}

/** Dragging changes the sound at once; letting go remembers it (and redraws the sheet). */
function volume(
  t: Translator<MessageKey>,
  s: PlayerSettings,
  bus: VolumeBus,
  run: Run,
): HTMLElement {
  const label = t(`settings.volume.${bus}`);
  const input = h('input', {
    class: 'ie-range',
    type: 'range',
    min: '0',
    max: '100',
    step: '1',
    value: String(Math.round(s.volumes[bus] * 100)),
    'aria-label': label,
  });
  const level = () => Number(input.value) / 100;
  input.addEventListener('input', () => run('audio.volume.set', { bus, volume: level() }));
  input.addEventListener('change', () => run('ui.volume.set', { bus, volume: level() }));
  return field(label, input);
}

/** Every control changes a setting through its action, so it applies (and re-renders) at once. */
export function fillSettings(
  body: HTMLElement,
  t: Translator<MessageKey>,
  s: PlayerSettings,
  run: Run,
): void {
  body.replaceChildren(
    field(
      t('settings.language'),
      segmented(
        LOCALES.map((l) => ({ value: l, label: LOCALE_INFO[l].nativeName })),
        s.locale,
        (locale) => run('ui.locale.set', { locale }),
        t('settings.language'),
      ),
    ),
    field(
      t('settings.theme'),
      segmented(
        THEME_PREFERENCES.map((v) => ({ value: v, label: t(`settings.theme.${v}`) })),
        s.theme,
        (theme) => run('ui.theme.set', { theme }),
        t('settings.theme'),
      ),
    ),
    field(
      t('settings.textSize'),
      segmented(
        TEXT_SIZES.map((v) => ({ value: v, label: t(`settings.textSize.${v}`) })),
        s.textSize,
        (size) => run('ui.textSize.set', { size }),
        t('settings.textSize'),
      ),
    ),
    field(
      t('settings.textSpeed'),
      segmented(
        TEXT_SPEEDS.map((v) => ({ value: v, label: t(`settings.textSpeed.${v}`) })),
        s.textSpeed,
        (speed) => run('ui.textSpeed.set', { speed }),
        t('settings.textSpeed'),
      ),
    ),
    field(
      t('settings.timers'),
      onOff(t, s.timers, (enabled) => run('ui.timers.set', { enabled }), t('settings.timers')),
    ),
    field(
      t('settings.fightAssist'),
      segmented(
        FIGHT_ASSISTS.map((v) => ({ value: v, label: t(`settings.fightAssist.${v}`) })),
        s.fightAssist,
        (assist) => run('ui.fightAssist.set', { assist }),
        t('settings.fightAssist'),
      ),
    ),
    field(
      t('settings.haptics'),
      onOff(t, s.haptics, (enabled) => run('ui.haptics.set', { enabled }), t('settings.haptics')),
    ),
    ...VOLUME_BUSES.map((bus) => volume(t, s, bus, run)),
    field(
      t('settings.hud'),
      onOff(t, s.hud, (visible) => run('ui.hud.set', { visible }), t('settings.hud')),
    ),
  );
}
