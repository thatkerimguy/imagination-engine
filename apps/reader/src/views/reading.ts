import type { ChapterDocument, ModuleBlock } from '@kn/core';
import { h } from '../dom.ts';
import { showCurtain } from '../curtain.ts';
import { loadChapter, loadNovel, loadSeason, novelUrl } from '../data.ts';
import { getPrefs } from '../prefs.ts';
import { renderBlock } from '../reading/blocks.ts';
import { readBookmark, saveBookmark } from '../reading/bookmark.ts';
import { Pacer } from '../reading/pacing.ts';
import type { Route } from '../router.ts';
import { ModuleHost } from '../runtime/module-host.ts';
import { deviceHints, resolveTier } from '../tier.ts';
import { applyTheme, type Cleanup, type ViewContext } from './shared.ts';

type ReadRoute = Extract<Route, { view: 'read' }>;

export async function readingView(v: ViewContext, route: ReadRoute): Promise<Cleanup> {
  const [novel, season, chapter] = await Promise.all([
    loadNovel(route.novel),
    loadSeason(route.novel, route.season),
    loadChapter(route.novel, route.season, route.chapter),
  ]);
  v.setBar(chapter.title, { view: 'chapters', novel: novel.id, season: season.id });
  applyTheme(v.main, novel.theme, season.accentColor);
  if (chapter.status === 'draft') {
    v.main.replaceChildren(h('p', { class: 'kn-empty' }, 'This chapter is not published yet.'));
    return () => undefined;
  }

  const enabled = new Set(novel.enabledModules);
  const blocks = chapter.blocks.filter((b) => {
    if (b.kind !== 'module' || enabled.has(b.moduleId)) return true;
    console.warn(`[reader] ${b.moduleId} is not enabled for ${novel.id}; skipping block ${b.id}`);
    return false;
  });
  const elements = blocks.map(renderBlock);
  const footer = h(
    'footer',
    { class: 'kn-chapter-end', hidden: true },
    h('span', { class: 'kn-break-mark' }, '◆'),
    await nextLink(v, route, season.chapters),
  );
  const article = h(
    'article',
    { class: 'kn-chapter' },
    h(
      'header',
      { class: 'kn-hero' },
      h('p', { class: 'kn-card-kicker' }, season.title),
      h('h1', {}, chapter.title),
    ),
    ...elements,
    footer,
  );
  v.main.replaceChildren(article);

  const mark = readBookmark(novel.id);
  const restoreId =
    route.block ??
    (mark?.chapterId === chapter.id && mark.seasonId === season.id ? mark.blockId : null);
  const restoreAt = restoreId ? blocks.findIndex((b) => b.id === restoreId) : -1;
  const tier = resolveTier(getPrefs().tier, deviceHints());
  document.documentElement.dataset.tier = tier;

  const pacer = new Pacer({
    blocks,
    elements,
    tier,
    restoreIndex: restoreAt > 0 ? restoreAt : null,
    createHost: (block: ModuleBlock, el, t) =>
      new ModuleHost(block, el, t, {
        stage: v.stage,
        audio: v.audio,
        resolveAsset: (path) => novelUrl(novel.id, path),
      }),
    onPosition(blockId) {
      saveBookmark(novel.id, { seasonId: season.id, chapterId: chapter.id, blockId });
      history.replaceState(history.state, '', `#b-${blockId}`);
    },
    onFinished: () => undefined,
    onLastSegment: () => (footer.hidden = false),
  });

  let disposed = false;
  void showCurtain(document.body, chapter.title, `${novel.title} · ${season.title}`, (sound) =>
    v.audio.unlock(sound),
  ).then(() => {
    if (!disposed) void pacer.start();
  });

  return () => {
    disposed = true;
    document.querySelector('.kn-curtain')?.remove();
    pacer.dispose();
    v.audio.stopAmbient(1.2);
  };
}

async function nextLink(
  v: ViewContext,
  route: ReadRoute,
  order: readonly string[],
): Promise<HTMLElement> {
  const i = order.indexOf(route.chapter);
  const nextId = order[i + 1];
  let next: ChapterDocument | null = null;
  if (nextId) next = await loadChapter(route.novel, route.season, nextId).catch(() => null);
  if (next && next.status === 'published') {
    return v.link({ ...route, chapter: next.id, block: null }, `Next: ${next.title} →`);
  }
  return v.link({ view: 'chapters', novel: route.novel, season: route.season }, 'Back to chapters');
}
