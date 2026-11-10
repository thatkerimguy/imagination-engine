import type { KeyValueStore } from '@ie/core';
import type { Translator } from '@ie/i18n';
import type { MessageKey } from '../messages.ts';
import { novelUrl } from '../story/load.ts';
import { addNovel, loadShelf, removeNovel, type Shelf } from './catalog.ts';
import { ShelfView } from './shelf-view.ts';

export interface ShelfHost {
  readonly store: KeyValueStore;
  readonly openSettings: () => void;
}

/**
 * Shows the bookshelf in `root`. Opening a book loads the page with `?novel=<id>`, so every novel
 * starts from a clean reader and the browser's Back returns to the shelf.
 */
export function mountShelf(
  root: HTMLElement,
  shelf: Shelf,
  t: Translator<MessageKey>,
  host: ShelfHost,
): { render(t: Translator<MessageKey>): void } {
  let current = t;
  const view: ShelfView = new ShelfView(t, {
    open: (book) => location.assign(novelUrl(book.id)),
    settings: host.openSettings,
    add: (file) => {
      void file.text().then(async (text) => {
        const result = await addNovel(host.store, text);
        if (typeof result !== 'string') {
          view.say(current('shelf.addFailed'));
          return;
        }
        const next = await loadShelf(host.store);
        view.show(next.books, result);
        const title = next.books.find((b) => b.id === result)?.title;
        view.say(current('shelf.added', { title: title?.[current.locale] || title?.en || result }));
      });
    },
    remove: (book) => {
      void removeNovel(host.store, book.id).then(async () => {
        view.show((await loadShelf(host.store)).books);
        view.say(current('shelf.removed'));
      });
    },
  });
  root.replaceChildren(view.element);
  view.show(shelf.books);
  document.title = t('shelf.title');
  return {
    render(next) {
      current = next;
      view.render(next);
      document.title = next('shelf.title');
    },
  };
}
