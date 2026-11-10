import {
  collectDeviceReport,
  renderReport,
  reportToText,
  type DeviceReport,
} from '@ie/diagnostics';
import type { Locale, Translator } from '@ie/i18n';
import { h } from './dom.ts';
import type { MessageKey } from './messages.ts';
import { fillHistory } from './panels/history-panel.ts';
import { fillSaves } from './panels/saves-panel.ts';
import { fillSettings } from './panels/settings-panel.ts';
import { fillSheet } from './panels/sheet-panel.ts';
import type { PlayerSettings } from './settings.ts';
import type { Panel } from './shell-module.ts';
import type { StoryController } from './story/controller.ts';

export interface DialogHandlers {
  readonly getSettings: () => PlayerSettings;
  readonly run: (actionId: string, params?: unknown) => void;
  readonly runAsync: (actionId: string, params?: unknown) => Promise<unknown>;
  /** The running story, if one opened. */
  readonly story: () => StoryController | null;
  /** Soft-hyphen inserter, once the patterns have loaded. */
  readonly hyphenate: () => ((text: string, locale: Locale) => string) | undefined;
  /** A sheet opened or closed (the story holds its clocks while one is open). */
  readonly onToggle: () => void;
}

const TITLES: Readonly<Record<Panel, MessageKey>> = {
  settings: 'settings.title',
  diagnostics: 'diagnostics.title',
  history: 'history.title',
  saves: 'saves.title',
  sheet: 'sheet.title',
};

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

/** The reader's sheets, built on native <dialog> for focus trapping and Esc. */
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
    if (panel !== 'settings' && panel !== 'diagnostics' && !this.handlers.story()) return;
    this.current?.close();
    const { dialog, body } = dialogShell(
      this.t(TITLES[panel]),
      this.t('dialog.close'),
      `${panel}-dialog`,
    );
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (this.current === dialog) {
        this.current = null;
        this.currentPanel = null;
      }
      this.handlers.onToggle();
    });
    document.body.append(dialog);
    this.current = dialog;
    this.currentPanel = panel;
    this.fill(panel, body, false);
    dialog.showModal();
    this.handlers.onToggle();
  }

  close(): void {
    this.current?.close();
  }

  /** Re-renders the open sheet in place (after a language or theme change). */
  render(t: Translator<MessageKey>): void {
    this.t = t;
    if (!this.current || !this.currentPanel) return;
    const panel = this.currentPanel;
    const body = this.current.querySelector<HTMLElement>('.ie-dialog__body');
    const title = this.current.querySelector('.ie-dialog__title');
    const close = this.current.querySelector('.ie-dialog__header button');
    if (title) title.textContent = t(TITLES[panel]);
    if (close) close.textContent = t('dialog.close');
    if (body) this.fill(panel, body, true);
  }

  private fill(panel: Panel, body: HTMLElement, rerender: boolean): void {
    const { t } = this;
    const story = this.handlers.story();
    const close = () => this.close();
    switch (panel) {
      case 'settings':
        fillSettings(body, t, this.handlers.getSettings(), this.handlers.run);
        break;
      case 'diagnostics':
        void this.fillDiagnostics(body, rerender);
        break;
      case 'history':
        if (story)
          fillHistory(body, {
            t,
            story,
            run: this.handlers.run,
            close,
            hyphenate: this.handlers.hyphenate(),
          });
        break;
      case 'saves':
        if (story) void fillSaves(body, { t, story, runAsync: this.handlers.runAsync, close });
        break;
      case 'sheet':
        if (story) fillSheet(body, t, story);
        break;
    }
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
