// Season list and chapter list: the two table-of-contents levels.
import { h } from '../dom.ts';
import { loadChapter, loadNovel, loadSeason } from '../data.ts';
import type { ViewContext } from './shared.ts';
import { applyTheme } from './shared.ts';

export async function seasonsView(v: ViewContext, novelId: string): Promise<void> {
  const novel = await loadNovel(novelId);
  v.setBar(novel.title, { view: 'shelf' });
  const seasons = await Promise.all(novel.seasons.map((s) => loadSeason(novelId, s)));
  const list = h('ul', { class: 'kn-list' });
  seasons.forEach((season, i) => {
    const item = h(
      'li',
      { class: 'kn-card' },
      v.link(
        { view: 'chapters', novel: novelId, season: season.id },
        h('span', { class: 'kn-card-kicker' }, `${novel.sectionLabel} ${i + 1}`),
        h('span', { class: 'kn-card-title' }, season.title),
        season.subtitle ? h('span', { class: 'kn-card-sub' }, season.subtitle) : null,
      ),
    );
    applyTheme(item, {}, season.accentColor);
    list.append(item);
  });
  const header = h(
    'header',
    { class: 'kn-hero' },
    h('h1', {}, novel.title),
    novel.subtitle ? h('p', { class: 'kn-hero-sub' }, novel.subtitle) : null,
    h('p', { class: 'kn-hero-by' }, `by ${novel.author}`),
  );
  applyTheme(v.main, novel.theme);
  v.main.replaceChildren(header, list);
}

export async function chaptersView(
  v: ViewContext,
  novelId: string,
  seasonId: string,
): Promise<void> {
  const [novel, season] = await Promise.all([loadNovel(novelId), loadSeason(novelId, seasonId)]);
  v.setBar(season.title, { view: 'seasons', novel: novelId });
  const chapters = await Promise.all(season.chapters.map((c) => loadChapter(novelId, seasonId, c)));
  const list = h('ol', { class: 'kn-list' });
  chapters
    .filter((c) => c.status === 'published')
    .forEach((chapter, i) => {
      list.append(
        h(
          'li',
          { class: 'kn-card' },
          v.link(
            { view: 'read', novel: novelId, season: seasonId, chapter: chapter.id, block: null },
            h('span', { class: 'kn-card-kicker' }, `Chapter ${i + 1}`),
            h('span', { class: 'kn-card-title' }, chapter.title),
          ),
        ),
      );
    });
  applyTheme(v.main, novel.theme, season.accentColor);
  v.main.replaceChildren(
    h(
      'header',
      { class: 'kn-hero' },
      h('h1', {}, season.title),
      season.subtitle ? h('p', { class: 'kn-hero-sub' }, season.subtitle) : null,
    ),
    list.childElementCount ? list : h('p', { class: 'kn-empty' }, 'No chapters published yet.'),
  );
}
