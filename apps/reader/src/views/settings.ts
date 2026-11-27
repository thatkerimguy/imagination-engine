// Reading settings sheet: size, theme, spectacle quality, sound.
import { h } from '../dom.ts';
import { dispatchTierChange } from '../runtime/tier-bus.ts';
import { deviceHints, resolveTier } from '../tier.ts';
import { FONT_SCALES, getPrefs, setPrefs, soundAllowed, type Prefs } from '../prefs.ts';
import { inPreviewMode, reportEndpoint } from '../report-endpoint.ts';
import type { AudioBus } from '../runtime/audio-bus.ts';

/** Published readers only: a Report abuse entry that is reachable mid-chapter (lazy modal). */
function reportButton(close: () => void): HTMLElement | null {
  const endpoint = reportEndpoint();
  const q = new URLSearchParams(location.search);
  const novelSlug = q.get('novel');
  if (!endpoint || !novelSlug || inPreviewMode()) return null;
  const chapterSlug = q.get('chapter') ?? undefined;
  const open = (): void => {
    close();
    void import('./report-modal.ts').then((m) =>
      m.openReportModal({ endpoint, novelSlug, ...(chapterSlug ? { chapterSlug } : {}) }),
    );
  };
  const attrs = { type: 'button', class: 'kn-report-btn', 'data-testid': 'settings-report-abuse' };
  return h('button', { ...attrs, onClick: open }, 'Report abuse');
}

function chips<T extends string>(
  label: string,
  options: readonly [T, string][],
  value: T,
  pick: (v: T) => void,
  testId?: string,
  overridden = false,
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
  return h(
    'div',
    {
      class: overridden ? 'kn-setting kn-overridden' : 'kn-setting',
      'data-testid': testId,
      'aria-disabled': overridden ? 'true' : undefined,
    },
    h('span', { class: 'kn-setting-label' }, label),
    group,
  );
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
          h(
            'button',
            {
              type: 'button',
              role: 'switch',
              class: 'kn-chip kn-calm',
              'data-testid': 'calm-mode',
              id: 'calm-mode',
              'aria-checked': String(p.calmMode),
              'aria-describedby': 'calm-mode-note',
              onClick: () => update({ calmMode: !p.calmMode }),
            },
            `Calm Mode: ${p.calmMode ? 'On' : 'Off'}`,
          ),
          h('span', { id: 'calm-mode-note', class: 'kn-setting-note' }, 'No motion, muted effects'),
        ),
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
            ['book', 'Book'],
            ['warm', 'Paper'],
            ['dark', 'Night'],
            ['obsidian', 'Obsidian'],
          ],
          p.theme,
          (theme) => update({ theme }),
          'settings-theme',
        ),
        chips(
          'Font',
          [
            ['book', 'Book'],
            ['serif', 'Serif'],
            ['sans', 'Sans'],
          ],
          p.font,
          (font) => update({ font }),
          'settings-font',
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
          'settings-spectacle',
          p.calmMode,
        ),
        chips(
          'Sound',
          [
            ['on', 'On'],
            ['off', 'Off'],
          ],
          p.sound ? 'on' : 'off',
          (s) => {
            update({ sound: s === 'on' });
          },
          'settings-sound',
          p.calmMode,
        ),
        h(
          'p',
          { class: 'kn-setting-note' },
          'Calm Mode, spectacle and sound changes apply now; 3D dice and ambient beds switch from the next chapter.',
        ),
        reportButton(close),
        h('button', { type: 'button', class: 'kn-sheet-close', onClick: close }, 'Done'),
      ),
    );
  };
  const update = (patch: Partial<Prefs>): void => {
    setPrefs(patch);
    const p = getPrefs();
    audio.setSound(soundAllowed(p));
    // v2 engines follow tier and Calm Mode live; no chapter reload.
    if ('tier' in patch || 'calmMode' in patch)
      dispatchTierChange(resolveTier(p.tier, deviceHints(p.calmMode)), p.calmMode);
    render(getPrefs());
  };
  sheet.addEventListener('click', (e) => e.target === sheet && close());
  render(getPrefs());
  document.body.append(sheet);
}
