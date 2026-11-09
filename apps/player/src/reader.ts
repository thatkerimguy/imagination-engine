import type { Translator } from '@ie/i18n';
import { h } from './dom.ts';
import type { MessageKey } from './messages.ts';

const LINES: readonly MessageKey[] = ['reader.line1', 'reader.line2', 'reader.line3'];

/**
 * Placeholder page until the story runtime arrives in Phase 1. It already behaves like the real
 * reader: one tap reveals the next line, and nothing else is on screen.
 */
export class Reader {
  readonly element: HTMLElement;
  private readonly page: HTMLElement;
  private readonly hint: HTMLElement;
  private shown = 1;
  private t: Translator<MessageKey>;

  constructor(t: Translator<MessageKey>) {
    this.t = t;
    this.page = h('article', { class: 'reader__page', 'aria-live': 'polite' });
    this.hint = h('p', { class: 'reader__hint', 'aria-hidden': 'true' });
    this.element = h('main', { class: 'reader', 'data-testid': 'reader' }, this.page, this.hint);
    this.element.addEventListener('click', () => this.advance());
    this.render(t);
  }

  get finished(): boolean {
    return this.shown > LINES.length;
  }

  advance(): void {
    if (this.finished) return;
    this.shown += 1;
    this.update();
  }

  render(t: Translator<MessageKey>): void {
    this.t = t;
    this.page.replaceChildren(
      ...LINES.map((key) => h('p', { class: 'reader__line' }, t(key))),
      h('p', { class: 'reader__end', 'aria-hidden': 'true' }, '⁂'),
    );
    this.hint.textContent = t('reader.hint');
    // Lines already revealed appear instantly after a language switch.
    this.update(true);
  }

  private update(instant = false): void {
    const lines = [...this.page.children] as HTMLElement[];
    lines.forEach((line, index) => {
      if (instant) line.dataset.instant = 'true';
      line.dataset.shown = String(index < this.shown);
    });
    if (instant) {
      requestAnimationFrame(() => {
        for (const line of lines) delete line.dataset.instant;
      });
    }
    this.hint.dataset.hidden = String(this.shown > 1);
    document.title = this.t('title.empty');
  }
}
