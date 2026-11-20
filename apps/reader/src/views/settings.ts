// Reading settings sheet: size, theme, spectacle quality, sound.
import { h } from '../dom.ts';
import { FONT_SCALES, getPrefs, setPrefs, type Prefs } from '../prefs.ts';
import type { AudioBus } from '../runtime/audio-bus.ts';

function chips<T extends string>(
  label: string,
  options: readonly [T, string][],
  value: T,
  pick: (v: T) => void,
): HTMLElement {
  const group = h('div', { class: 'kn-chips', role: 'radiogroup', 'aria-label': label });
  for (const [v, text] of options) {
    group.append(
      h(
        'button',
        {
          type: 'button',
          role: 'radio',
          class: 'kn-chip',
          'aria-checked': String(v === value),
          onClick: () => pick(v),
        },
        text,
      ),
    );
  }
  return h('div', { class: 'kn-setting' }, h('span', { class: 'kn-setting-label' }, label), group);
}

export function openSettings(audio: AudioBus): void {
  document.querySelector('.kn-sheet')?.remove();
  const sheet = h('div', { class: 'kn-sheet', role: 'dialog', 'aria-label': 'Reading settings' });
  const close = (): void => {
    sheet.remove();
    removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  addEventListener('keydown', onKey);
  const render = (p: Prefs): void => {
    const idx = FONT_SCALES.indexOf(p.fontScale as (typeof FONT_SCALES)[number]);
    const size = (d: number) => (): void => {
      const next =
        FONT_SCALES[Math.max(0, Math.min(FONT_SCALES.length - 1, (idx < 0 ? 2 : idx) + d))]!;
      update({ fontScale: next });
    };
    sheet.replaceChildren(
      h(
        'div',
        { class: 'kn-sheet-panel' },
        h(
          'div',
          { class: 'kn-setting' },
          h('span', { class: 'kn-setting-label' }, 'Text size'),
          h(
            'div',
            { class: 'kn-chips' },
            h(
              'button',
              { type: 'button', class: 'kn-chip', 'aria-label': 'Smaller text', onClick: size(-1) },
              'A−',
            ),
            h('span', { class: 'kn-size' }, `${Math.round(p.fontScale * 100)}%`),
            h(
              'button',
              { type: 'button', class: 'kn-chip', 'aria-label': 'Larger text', onClick: size(1) },
              'A+',
            ),
          ),
        ),
        chips(
          'Theme',
          [
            ['warm', 'Warm'],
            ['dark', 'Dark'],
            ['obsidian', 'Obsidian'],
          ],
          p.theme,
          (theme) => update({ theme }),
        ),
        chips(
          'Spectacle',
          [
            ['auto', 'Auto'],
            ['high', 'High'],
            ['lite', 'Lite'],
            ['reduced', 'Reduced motion'],
          ],
          p.tier,
          (tier) => update({ tier }),
        ),
        chips(
          'Sound',
          [
            ['on', 'On'],
            ['off', 'Off'],
          ],
          p.sound ? 'on' : 'off',
          (s) => {
            audio.setSound(s === 'on');
            update({ sound: s === 'on' });
          },
        ),
        h(
          'p',
          { class: 'kn-setting-note' },
          'Spectacle changes apply from the next chapter you open.',
        ),
        h('button', { type: 'button', class: 'kn-sheet-close', onClick: close }, 'Done'),
      ),
    );
  };
  const update = (patch: Partial<Prefs>): void => {
    setPrefs(patch);
    render(getPrefs());
  };
  sheet.addEventListener('click', (e) => e.target === sheet && close());
  render(getPrefs());
  document.body.append(sheet);
}
