import {
  collectDeviceReport,
  renderReport,
  reportToText,
  type DeviceReport,
} from '@ie/diagnostics';
import { LOCALES, LOCALE_INFO, type Translator } from '@ie/i18n';
import { THEME_PREFERENCES } from '@ie/ui-kit';
import { h, segmented } from './dom.ts';
import type { MessageKey } from './messages.ts';
import { TEXT_SIZES, type PlayerSettings } from './settings.ts';
import type { Panel } from './shell-module.ts';

export interface DialogHandlers {
  readonly getSettings: () => PlayerSettings;
  readonly run: (actionId: string, params: unknown) => void;
}

function dialogShell(title: string, closeLabel: string, testId: string) {
  const body = h('div', { class: 'ie-dialog__body' });
  const close = h('button', { type: 'button', class: 'ie-button ie-button--quiet' }, closeLabel);
  const dialog = h(
    'dialog',
    { class: 'ie-dialog', 'data-testid': testId, 'aria-label': title },
    h(
      'header',
      { class: 'ie-dialog__header' },
      h('h2', { class: 'ie-dialog__title' }, title),
      close,
    ),
    body,
  );
  close.addEventListener('click', () => dialog.close());
  // A click on the backdrop lands on the <dialog> element itself.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  return { dialog, body };
}

/** Settings and Diagnostics sheets, built on native <dialog> for focus trapping and Esc. */
export class Dialogs {
  private current: HTMLDialogElement | null = null;
  private currentPanel: Panel | null = null;
  private report: DeviceReport | null = null;

  constructor(
    private t: Translator<MessageKey>,
    private readonly handlers: DialogHandlers,
  ) {}

  get isOpen(): boolean {
    return this.current?.open ?? false;
  }

  open(panel: Panel): void {
    this.current?.close();
    const { dialog, body } =
      panel === 'settings'
        ? dialogShell(this.t('settings.title'), this.t('dialog.close'), 'settings-dialog')
        : dialogShell(this.t('diagnostics.title'), this.t('dialog.close'), 'diagnostics-dialog');
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (this.current === dialog) {
        this.current = null;
        this.currentPanel = null;
      }
    });
    document.body.append(dialog);
    this.current = dialog;
    this.currentPanel = panel;
    if (panel === 'settings') this.fillSettings(body);
    else void this.fillDiagnostics(body, false);
    dialog.showModal();
  }

  /** Re-renders the open sheet in place (after a language or theme change). */
  render(t: Translator<MessageKey>): void {
    this.t = t;
    if (!this.current || !this.currentPanel) return;
    const panel = this.currentPanel;
    const body = this.current.querySelector<HTMLElement>('.ie-dialog__body');
    const title = this.current.querySelector('.ie-dialog__title');
    const close = this.current.querySelector('.ie-dialog__header button');
    if (title) title.textContent = t(panel === 'settings' ? 'settings.title' : 'diagnostics.title');
    if (close) close.textContent = t('dialog.close');
    if (!body) return;
    if (panel === 'settings') this.fillSettings(body);
    else void this.fillDiagnostics(body, true);
  }

  private fillSettings(body: HTMLElement): void {
    const t = this.t;
    const s = this.handlers.getSettings();
    const field = (label: string, control: HTMLElement) =>
      h('div', { class: 'ie-field' }, h('span', { class: 'ie-label' }, label), control);
    const run = this.handlers.run;
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
        t('settings.hud'),
        segmented(
          [
            { value: 'off', label: t('settings.off') },
            { value: 'on', label: t('settings.on') },
          ],
          s.hud ? 'on' : 'off',
          (v) => run('ui.hud.set', { visible: v === 'on' }),
          t('settings.hud'),
        ),
      ),
    );
  }

  private async fillDiagnostics(body: HTMLElement, reuse: boolean): Promise<void> {
    const t = this.t;
    const locale = t.locale;
    if (!reuse || !this.report) {
      body.replaceChildren(h('p', { class: 'muted' }, t('diagnostics.collecting')));
      const activated = navigator.userActivation?.hasBeenActive ?? true;
      this.report = await collectDeviceReport({ probeAudio: activated });
    }
    const report = this.report;
    const copy = h('button', { type: 'button', class: 'ie-button' }, t('diagnostics.copy'));
    copy.addEventListener('click', () => {
      void navigator.clipboard
        ?.writeText(reportToText(report))
        .then(() => (copy.textContent = this.t('diagnostics.copied')));
    });
    const again = h(
      'button',
      { type: 'button', class: 'ie-button ie-button--quiet' },
      t('diagnostics.refresh'),
    );
    again.addEventListener('click', () => void this.fillDiagnostics(body, false));
    body.replaceChildren(
      renderReport(report, locale),
      h('div', { class: 'dialog-actions' }, copy, again),
    );
  }
}
