import type { DnaArchetypeId } from '@kn/core/dna';
import type { QualityTier } from '@kn/core/renderer';
import type { ChapterDocument, ModuleBlock, NovelManifest, SeasonManifest } from '@kn/core/guard';
import { h } from '../dom.ts';
import { showCurtain } from '../curtain.ts';
import { loadChapter, loadNovel, loadSeason, novelUrl } from '../data.ts';
import { getPrefs, soundAllowed, type TierPreference } from '../prefs.ts';
import { inPreviewMode, reportEndpoint } from '../report-endpoint.ts';
import { renderBlock } from '../reading/blocks.ts';
import { readBookmark, saveBookmark } from '../reading/bookmark.ts';
import { Pacer } from '../reading/pacing.ts';
import type { Route } from '../router.ts';
import { createBlockHost } from '../runtime/block-host.ts';
import { seedTier } from '../runtime/tier-bus.ts';
import { deviceHints, resolveTier } from '../tier.ts';
import { applyTheme, type Cleanup, type ViewContext } from './shared.ts';

type ReadRoute = Extract<Route, { view: 'read' }>;

export interface ChapterData {
  novel: NovelManifest;
  season: SeasonManifest;
  chapter: ChapterDocument;
}

export interface MountOptions {
  startBlockId: string | null;
  /** Shown under the last segment (next chapter / back link). */
  footerLink: HTMLElement;
  /** Overrides the reader's own tier preference (writer preview). */
  tier?: TierPreference;
  /** Writer preview: drafts render, no bookmarks or URL updates, curtain optional. */
  preview?: { curtain: boolean; onAudioUnlocked(): void; onPosition?: (blockId: string) => void };
  /** Host accessibility setting (writer preview); forces the reduced tier. */
  reducedMotion?: boolean;
  /** DNA archetype used when the book has no visualDna. */
  dnaFallback?: DnaArchetypeId;
}

export async function readingView(v: ViewContext, route: ReadRoute): Promise<Cleanup> {
  const [novel, season, chapter] = await Promise.all([
    loadNovel(route.novel),
    loadSeason(route.novel, route.season),
    loadChapter(route.novel, route.season, route.chapter),
  ]);
  v.setBar(chapter.title, { view: 'chapters', novel: novel.id, season: season.id });
  if (chapter.status === 'draft') {
    applyTheme(v.main, novel.theme, season.accentColor);
    v.main.replaceChildren(h('p', { class: 'kn-empty' }, 'This chapter is not published yet.'));
    return () => undefined;
  }
  const mark = readBookmark(novel.id);
  const resume =
    mark?.chapterId === chapter.id && mark.seasonId === season.id ? mark.blockId : null;
  return mountChapter(
    v,
    { novel, season, chapter },
    {
      startBlockId: route.block ?? resume,
      footerLink: await nextLink(v, route, season.chapters),
    },
  );
}

/** Renders and paces one chapter from in-memory data (shared by reading and writer preview). */
export function mountChapter(v: ViewContext, data: ChapterData, opts: MountOptions): Cleanup {
  const { novel, season, chapter } = data;
  const preview = opts.preview;
  applyTheme(v.main, novel.theme, season.accentColor);
  const enabled = new Set(novel.enabledModules);
  const blocks = chapter.blocks.filter((b) => {
    // v2 cues (props.blueprintId) are data, always allowed; v1 cues still need enabledModules.
    if (b.kind !== 'module' || typeof b.props.blueprintId === 'string' || enabled.has(b.moduleId))
      return true;
    console.warn(`[reader] ${b.moduleId} is not enabled for ${novel.id}; skipping block ${b.id}`);
    return false;
  });
  const elements = blocks.map(renderBlock);
  const endpoint = reportEndpoint();
  let closeReport: (() => void) | null = null;
  const footer = h(
    'footer',
    { class: 'kn-chapter-end', hidden: true },
    h('span', { class: 'kn-break-mark' }, '◆'),
    opts.footerLink,
    endpoint && !preview && !inPreviewMode()
      ? h(
          'button',
          {
            type: 'button',
            class: 'kn-report-btn',
            'data-testid': 'report-abuse',
            onClick: (e: Event) => {
              const returnFocus = e.currentTarget as HTMLElement;
              void import('./report-modal.ts').then((m) => {
                closeReport?.();
                closeReport = m.openReportModal({
                  endpoint,
                  novelSlug: novel.id,
                  chapterSlug: chapter.id,
                  returnFocus,
                });
              });
            },
          },
          'Report abuse',
        )
      : null,
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
  // Book Visual DNA lands on open, even for prose-only chapters (own lazy chunk).
  void import('../dna-apply.ts').then((d) => {
    if (article.isConnected)
      d.attachDna(v.main, d.bookDna(chapter.visualDna ?? novel.visualDna, opts.dnaFallback));
  });

  const restoreAt = opts.startBlockId ? blocks.findIndex((b) => b.id === opts.startBlockId) : -1;
  const tierPref = opts.tier ?? getPrefs().tier;
  const calm = !!opts.reducedMotion || getPrefs().calmMode;
  const tier: QualityTier = resolveTier(tierPref, deviceHints(calm));
  document.documentElement.dataset.tier = tier;
  seedTier(tier, calm);
  // The GL stage keeps full 2x sharpness only for an explicit High choice (webgl-stage.ts).
  document.documentElement.dataset.tierPref = tierPref;

  const pacer = new Pacer({
    blocks,
    elements,
    tier,
    restoreIndex: restoreAt > 0 ? restoreAt : null,
    createHost: (block: ModuleBlock, el, t) =>
      createBlockHost(block, el, t, {
        audio: v.audio,
        resolveAsset: (path) => novelUrl(novel.id, path),
        dnaRoot: v.main,
        visualDna: chapter.visualDna ?? novel.visualDna,
        dnaFallback: opts.dnaFallback,
        blueprints: chapter.blueprints,
      }),
    onPosition(blockId) {
      if (preview) return preview.onPosition?.(blockId);
      saveBookmark(novel.id, { seasonId: season.id, chapterId: chapter.id, blockId });
      history.replaceState(history.state, '', `#b-${blockId}`);
    },
    onFinished: () => undefined,
    onLastSegment: () => (footer.hidden = false),
  });

  let disposed = false;
  const curtain =
    preview && !preview.curtain
      ? Promise.resolve()
      : showCurtain(document.body, chapter.title, `${novel.title} · ${season.title}`, (sound) => {
          v.audio.unlock(sound && soundAllowed(getPrefs()));
          preview?.onAudioUnlocked();
        });
  void curtain.then(() => {
    if (!disposed) void pacer.start();
  });

  return () => {
    disposed = true;
    closeReport?.();
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
