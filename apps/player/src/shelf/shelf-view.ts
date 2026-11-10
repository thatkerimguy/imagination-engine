import { upper, type Translator } from '@ie/i18n';
import { resolveStoryTheme } from '@ie/present';
import { h } from '../dom.ts';
import type { MessageKey } from '../messages.ts';
import type { Book } from './catalog.ts';

export interface ShelfHandlers {
  open(book: Book): void;
  add(file: File): void;
  remove(book: Book): void;
  settings(): void;
}

/**
 * The bookshelf (ADR 0022): novels side by side on a row that slides with a swipe, the mouse wheel,
 * the arrow keys or the buttons below it. The book in the middle is the one Enter opens.
 */
export class ShelfView {
  readonly element: HTMLElement;
  private readonly track: HTMLElement;
  private readonly status: HTMLElement;
  private books: readonly Book[] = [];
  private active = 0;
  private frame = 0;
  /** A remove button pressed once; the second press removes. */
  private confirming: string | null = null;

  constructor(
    private t: Translator<MessageKey>,
    private readonly handlers: ShelfHandlers,
  ) {
    this.track = h('div', { class: 'shelf__track', role: 'list', 'data-testid': 'shelf-track' });
    this.status = h('p', { class: 'shelf__status', role: 'status', 'data-testid': 'shelf-status' });
    this.element = h('main', { class: 'shelf', 'data-testid': 'shelf' });
    // Scroll events come only while the row moves: no work at rest.
    this.track.addEventListener('scroll', () => {
      if (!this.frame) this.frame = requestAnimationFrame(() => this.findActive());
    });
    // A vertical wheel slides the row sideways on desktop.
    this.track.addEventListener(
      'wheel',
      (event) => {
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
        event.preventDefault();
        this.track.scrollBy({ left: event.deltaY, behavior: 'auto' });
      },
      { passive: false },
    );
    this.element.addEventListener('keydown', (event) => this.key(event));
  }

  show(books: readonly Book[], focusId?: string): void {
    this.books = books;
    const found = focusId ? books.findIndex((b) => b.id === focusId) : -1;
    this.active = found >= 0 ? found : Math.min(this.active, Math.max(0, books.length - 1));
    this.render(this.t);
    requestAnimationFrame(() => this.scrollTo(this.active, 'instant'));
  }

  say(text: string): void {
    this.status.textContent = text;
  }

  render(t: Translator<MessageKey>): void {
    this.t = t;
    const locale = t.locale;
    const books = this.books.map((book, i) => this.bookCard(book, i, locale));
    this.track.replaceChildren(...books, this.addCard());
    const prev = this.navButton('‹', t('shelf.prev'), -1, 'shelf-prev');
    const next = this.navButton('›', t('shelf.next'), 1, 'shelf-next');
    const settings = h(
      'button',
      { type: 'button', class: 'ie-button ie-button--quiet', 'data-testid': 'shelf-settings' },
      t('menu.settings'),
    );
    settings.addEventListener('click', () => this.handlers.settings());
    this.element.replaceChildren(
      h(
        'header',
        { class: 'shelf__head' },
        h('h1', { class: 'shelf__title' }, t('shelf.title')),
        settings,
      ),
      this.track,
      h('div', { class: 'shelf__nav' }, prev, this.status, next),
    );
    this.markActive();
  }

  private bookCard(book: Book, index: number, locale: 'en' | 'tr'): HTMLElement {
    const t = this.t;
    const title = book.title[locale] || book.title.en || book.title.tr || book.id;
    const look = resolveStoryTheme(book.theme);
    const cover = h(
      'button',
      { type: 'button', class: 'book__cover', 'data-testid': 'book-cover', 'aria-label': title },
      h('span', { class: 'book__langs' }, book.languages.map((l) => upper(l, 'en')).join(' · ')),
      h('span', { class: 'book__title' }, title),
      h('span', { class: 'book__author' }, book.author ?? ''),
      h('span', { class: 'book__source' }, t(`shelf.source.${book.source}` as MessageKey)),
    );
    // The cover wears the novel's own look: its theme's tokens, scoped to this book.
    for (const [name, value] of Object.entries(look.vars))
      if (name.startsWith('--')) cover.style.setProperty(name, value);
    cover.addEventListener('click', () => {
      if (index === this.active) this.handlers.open(book);
      else this.scrollTo(index, 'smooth');
    });
    const open = h(
      'button',
      { type: 'button', class: 'ie-button ie-button--primary', 'data-testid': 'book-open' },
      t(book.started ? 'shelf.continue' : 'shelf.read'),
    );
    open.addEventListener('click', () => this.handlers.open(book));
    const actions = h('div', { class: 'book__actions' }, open);
    if (book.source === 'added') {
      const asking = this.confirming === book.id;
      const remove = h(
        'button',
        { type: 'button', class: 'ie-button ie-button--quiet', 'data-testid': 'book-remove' },
        t(asking ? 'shelf.removeConfirm' : 'shelf.remove'),
      );
      remove.addEventListener('click', () => {
        if (this.confirming !== book.id) {
          this.confirming = book.id;
          this.render(this.t);
          return;
        }
        this.confirming = null;
        this.handlers.remove(book);
      });
      actions.append(remove);
    }
    return h(
      'article',
      { class: 'book', role: 'listitem', 'data-testid': 'book', 'data-id': book.id },
      cover,
      actions,
    );
  }

  private addCard(): HTMLElement {
    const t = this.t;
    const input = h('input', {
      type: 'file',
      accept: '.json,application/json',
      class: 'book__file',
      'data-testid': 'shelf-add-file',
      'aria-label': t('shelf.add'),
    });
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) this.handlers.add(file);
      input.value = '';
    });
    const button = h(
      'button',
      { type: 'button', class: 'book__cover book__cover--add', 'data-testid': 'shelf-add' },
      h('span', { class: 'book__plus', 'aria-hidden': 'true' }, '+'),
      h('span', { class: 'book__title' }, t('shelf.add')),
      h('span', { class: 'book__author' }, t('shelf.addHint')),
    );
    button.addEventListener('click', () => input.click());
    return h('article', { class: 'book book--add', role: 'listitem' }, button, input);
  }

  private navButton(glyph: string, label: string, step: number, testId: string) {
    const button = h(
      'button',
      { type: 'button', class: 'shelf__arrow', 'aria-label': label, 'data-testid': testId },
      glyph,
    );
    button.addEventListener('click', () => this.scrollTo(this.active + step, 'smooth'));
    return button;
  }

  private cards(): HTMLElement[] {
    return [...this.track.children] as HTMLElement[];
  }

  private scrollTo(index: number, behavior: ScrollBehavior): void {
    const cards = this.cards();
    const i = Math.max(0, Math.min(cards.length - 1, index));
    const card = cards[i];
    if (!card) return;
    const left = card.offsetLeft - (this.track.clientWidth - card.offsetWidth) / 2;
    this.track.scrollTo({ left, behavior });
    this.active = i;
    this.markActive();
  }

  /** The card nearest the middle of the row. */
  private findActive(): void {
    this.frame = 0;
    const middle = this.track.scrollLeft + this.track.clientWidth / 2;
    let best = 0;
    let distance = Infinity;
    this.cards().forEach((card, i) => {
      const d = Math.abs(card.offsetLeft + card.offsetWidth / 2 - middle);
      if (d < distance) {
        distance = d;
        best = i;
      }
    });
    if (best !== this.active) {
      this.active = best;
      this.markActive();
    }
  }

  private markActive(): void {
    this.cards().forEach((card, i) => {
      card.dataset.active = String(i === this.active);
    });
  }

  private key(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === 'ArrowRight') this.scrollTo(this.active + 1, 'smooth');
    else if (event.key === 'ArrowLeft') this.scrollTo(this.active - 1, 'smooth');
    else if (event.key === 'Home') this.scrollTo(0, 'smooth');
    else if (event.key === 'End') this.scrollTo(this.books.length, 'smooth');
    else return;
    event.preventDefault();
  }
}
