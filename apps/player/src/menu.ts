import type { Translator } from '@ie/i18n';
import { h } from './dom.ts';
import type { MessageKey } from './messages.ts';
import type { Panel } from './shell-module.ts';

export interface MenuHandlers {
  close(): void;
  back(): void;
  openPanel(panel: Panel): void;
  /** Whether the story has a character sheet to offer. */
  hasSheet(): boolean;
}

/**
 * The only chrome in the reader: an invisible strip along the top edge that summons a single
 * hairline row of quiet text buttons.
 */
export class Menu {
  readonly trigger: HTMLButtonElement;
  readonly element: HTMLElement;
  private open = false;

  constructor(
    private t: Translator<MessageKey>,
    private readonly handlers: MenuHandlers,
    onTrigger: () => void,
  ) {
    this.trigger = h('button', { class: 'menu-zone', type: 'button', 'data-testid': 'menu-zone' });
    this.trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      onTrigger();
    });
    this.element = h('nav', { class: 'menu', 'data-open': 'false', 'data-testid': 'menu' });
    document.addEventListener('fullscreenchange', () => this.render(this.t));
    this.render(t);
  }

  get isOpen(): boolean {
    return this.open;
  }

  setOpen(open: boolean): void {
    this.open = open;
    this.element.dataset.open = String(open);
    this.element.inert = !open;
    this.trigger.setAttribute('aria-expanded', String(open));
    if (open) this.element.querySelector('button')?.focus({ preventScroll: true });
  }

  render(t: Translator<MessageKey>): void {
    this.t = t;
    this.trigger.setAttribute('aria-label', t('menu.open'));
    this.element.setAttribute('aria-label', t('menu.label'));
    const item = (label: string, onClick: () => void, testId: string) => {
      const button = h(
        'button',
        { type: 'button', class: 'menu__item', 'data-testid': testId },
        label,
      );
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        onClick();
      });
      return button;
    };
    const items = [
      item(t('menu.continue'), () => this.handlers.close(), 'menu-continue'),
      item(t('menu.back'), () => this.handlers.back(), 'menu-back'),
      item(t('menu.history'), () => this.handlers.openPanel('history'), 'menu-history'),
      item(t('menu.saves'), () => this.handlers.openPanel('saves'), 'menu-saves'),
      ...(this.handlers.hasSheet()
        ? [item(t('menu.sheet'), () => this.handlers.openPanel('sheet'), 'menu-sheet')]
        : []),
      item(t('menu.settings'), () => this.handlers.openPanel('settings'), 'menu-settings'),
      item(t('menu.diagnostics'), () => this.handlers.openPanel('diagnostics'), 'menu-diagnostics'),
    ];
    if (typeof document.documentElement.requestFullscreen === 'function') {
      const full = document.fullscreenElement !== null;
      items.push(
        item(
          full ? t('menu.exitFullscreen') : t('menu.fullscreen'),
          () =>
            void (full ? document.exitFullscreen() : document.documentElement.requestFullscreen()),
          'menu-fullscreen',
        ),
      );
    }
    this.element.replaceChildren(...items);
    this.element.inert = !this.open;
  }
}
