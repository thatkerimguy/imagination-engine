import { describe, expect, it } from 'vitest';
import { parseRoute, routeHref } from './router.ts';

describe('router', () => {
  it('round-trips every view', () => {
    const routes = [
      { view: 'shelf' },
      { view: 'seasons', novel: 'vertical-slice' },
      { view: 'chapters', novel: 'vertical-slice', season: 's01' },
      {
        view: 'read',
        novel: 'vertical-slice',
        season: 's01',
        chapter: 'ch01',
        block: '01M7WD7TG54FMBWYMZM8XKD1V7',
      },
    ] as const;
    for (const route of routes) {
      const href = new URL(routeHref(route), 'https://x.test/');
      expect(parseRoute(href.search, href.hash)).toEqual(route);
    }
  });

  it('ignores junk', () => {
    expect(parseRoute('?novel=../../etc', '')).toEqual({ view: 'shelf' });
    expect(parseRoute('?novel=a&season=b&chapter=c', '#b-nope')).toMatchObject({ block: null });
  });
});
