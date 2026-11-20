import { h } from '../dom.ts';
import { loadLibrary, loadNovel } from '../data.ts';
import { readBookmark } from '../reading/bookmark.ts';
import type { ViewContext } from './shared.ts';
import { applyTheme } from './shared.ts';

export async function shelfView(v: ViewContext): Promise<void> {
  v.setBar('Bookshelf', null);
  const novels = await Promise.all((await loadLibrary()).map((id) => loadNovel(id)));
  const list = h('ul', { class: 'kn-list kn-shelf' });
  for (const novel of novels) {
    const mark = readBookmark(novel.id);
    const card = h(
      'li',
      { class: 'kn-card' },
      v.link(
        { view: 'seasons', novel: novel.id },
        h('span', { class: 'kn-card-title' }, novel.title),
        h(
          'span',
          { class: 'kn-card-sub' },
          [novel.subtitle, novel.author].filter(Boolean).join(' · '),
        ),
      ),
      mark
        ? v.link(
            {
              view: 'read',
              novel: novel.id,
              season: mark.seasonId,
              chapter: mark.chapterId,
              block: mark.blockId,
            },
            h('span', { class: 'kn-resume' }, 'Continue reading →'),
          )
        : null,
    );
    applyTheme(card, novel.theme);
    list.append(card);
  }
  v.main.replaceChildren(
    novels.length ? list : h('p', { class: 'kn-empty' }, 'No novels on this shelf yet.'),
  );
}
