import type { Translator } from '@ie/i18n';
import { h } from './dom.ts';
import type { MessageKey } from './messages.ts';

/** Taps on these belong to the control, not to the page. */
const INTERACTIVE = 'button, input, textarea, select, a, label, summary';

/**
 * The reading surface: a scrolling page that holds the story and turns taps into "continue".
 * Nothing else is on screen.
 */
export class Reader {
  readonly element: HTMLElement;
  private readonly hint: HTMLElement;
  private t: Translator<MessageKey>;

  constructor(t: Translator<MessageKey>, onTap: () => void) {
    this.t = t;
    this.hint = h('p', { class: 'reader__hint', 'aria-hidden': 'true', 'data-hidden': 'true' });
    this.element = h('main', { class: 'reader', 'data-testid': 'reader' }, this.hint);
    this.element.addEventListener('click', (event) => {
      const target = event.target as Element | null;
      if (target?.closest(INTERACTIVE)) return;
      // Selecting text to copy a quote shouldn't turn the page.
      if (!document.getSelection()?.isCollapsed) return;
      this.hint.dataset.hidden = 'true';
      onTap();
    });
    this.render(t);
  }

  /** Puts the story (or an error) on the page. */
  mount(content: HTMLElement): void {
    this.element.replaceChildren(content, this.hint);
  }

  /** "Tap to continue", shown once at the very start of a story. */
  showHint(): void {
    this.hint.dataset.hidden = 'false';
  }

  showError(message: string, details: readonly string[]): void {
    this.mount(
      h(
        'div',
        { class: 'reader__error', role: 'alert' },
        h('p', {}, message),
        ...(details.length
          ? [h('ul', { class: 'muted' }, ...details.map((d) => h('li', {}, d)))]
          : []),
      ),
    );
    document.title = this.t('title.empty');
  }

  render(t: Translator<MessageKey>): void {
    this.t = t;
    this.hint.textContent = t('reader.hint');
  }
}
