import { h } from './dom.ts';
import { parseRoute, routeHref, type Route } from './router.ts';
import { createAudioBus } from './runtime/audio-bus.ts';
import { createStage } from './runtime/stage.ts';
import { readingView } from './views/reading.ts';
import { openSettings } from './views/settings.ts';
import { errorView, type Cleanup, type ViewContext } from './views/shared.ts';
import { shelfView } from './views/shelf.ts';
import { chaptersView, seasonsView } from './views/toc.ts';

export function startApp(): void {
  const back = h('span', { class: 'kn-back-slot' });
  const title = h('span', { class: 'kn-bar-title' });
  const audio = createAudioBus();
  const bar = h(
    'header',
    { class: 'kn-bar' },
    back,
    title,
    h(
      'button',
      {
        type: 'button',
        class: 'kn-settings-btn',
        'aria-label': 'Reading settings',
        onClick: () => openSettings(audio),
      },
      'Aa',
    ),
  );
  const main = h('main', { class: 'kn-main', id: 'main' });
  document.body.append(bar, main);
  const stage = createStage();

  let cleanup: Cleanup | null = null;
  let generation = 0;

  const navigate = (route: Route, push = true): void => {
    if (push) history.pushState(null, '', routeHref(route));
    void show(route);
  };

  const link = (route: Route, ...children: (Node | string | null)[]): HTMLAnchorElement => {
    const a = h('a', { href: routeHref(route) }, ...children);
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      navigate(route);
    });
    return a;
  };

  const ctx: ViewContext = {
    main,
    stage,
    audio,
    link,
    setBar(text, backTo) {
      title.textContent = text;
      document.title = backTo ? `${text} · Kinetic Reader` : 'Kinetic Reader';
      const a = backTo ? link(backTo, '‹') : null;
      a?.setAttribute('class', 'kn-back');
      a?.setAttribute('aria-label', 'Back');
      back.replaceChildren(...(a ? [a] : []));
    },
  };

  const show = async (route: Route): Promise<void> => {
    const mine = ++generation;
    cleanup?.();
    cleanup = null;
    main.removeAttribute('style');
    main.replaceChildren();
    scrollTo(0, 0);
    try {
      let result: Cleanup | null = null;
      if (route.view === 'shelf') await shelfView(ctx);
      else if (route.view === 'seasons') await seasonsView(ctx, route.novel);
      else if (route.view === 'chapters') await chaptersView(ctx, route.novel, route.season);
      else result = await readingView(ctx, route);
      if (mine !== generation) result?.();
      else cleanup = result;
    } catch (err) {
      if (mine === generation) errorView(main, err);
    }
  };

  addEventListener('popstate', () => void show(parseRoute(location.search, location.hash)));
  void show(parseRoute(location.search, location.hash));
}
