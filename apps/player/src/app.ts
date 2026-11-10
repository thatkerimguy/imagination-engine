import { AudioDirector, AudioEngine, createAudioModule } from '@ie/audio';
import {
  Kernel,
  createMemoryStore,
  isIndexedDbSupported,
  openIndexedDbStore,
  type KeyValueStore,
} from '@ie/core';
import { PerfHud } from '@ie/diagnostics';
import { LOCALE_INFO, createTranslator, loadHyphenators, type Locale } from '@ie/i18n';
import {
  ScreenHost,
  StoryPresenter,
  applyStoryTheme,
  resolveStoryTheme,
  type PresenterOptions,
} from '@ie/present';
import type { Assist } from '@ie/rhythm';
import { createSequenceModule, SequenceRunner } from '@ie/sequencer';
import { createStageHost, createStageModule } from '@ie/stage';
import { StoryLoadError, type Beat, type CompiledStory } from '@ie/story';
import { applyTheme, watchSystemTheme } from '@ie/ui-kit';
import { Dialogs } from './dialogs.ts';
import { Menu } from './menu.ts';
import { hasSheet } from './panels/sheet-panel.ts';
import { messages } from './messages.ts';
import { Reader } from './reader.ts';
import {
  VOLUME_BUSES,
  loadSettings,
  saveSettings,
  type FightAssist,
  type PlayerSettings,
} from './settings.ts';
import { LazyRunner } from './lazy-runner.ts';
import { mountShelf } from './shelf/mount.ts';
import { applyAccess } from './access.ts';
import { createShellModule } from './shell-module.ts';
import { StoryController } from './story/controller.ts';
import { novelUrl, openStory } from './story/load.ts';
import { createStoryModule } from './story/module.ts';
import { StorySession } from './story/session.ts';

type FightBeat = Extract<Beat, { kind: 'fight' }>;
type MinigameBeat = Extract<Beat, { kind: 'minigame' }>;

const ASSISTS: Readonly<Record<FightAssist, Assist>> = {
  off: {},
  wide: { wide: true },
  noFail: { noFail: true },
  auto: { auto: true },
};

const ADVANCE_KEYS = new Set([' ', 'Enter', 'ArrowRight', 'ArrowDown', 'PageDown']);
const BACK_KEYS = new Set(['ArrowLeft', 'Backspace', 'PageUp']);

/** Project data lives in IndexedDB; a private window without it still plays, just without saves. */
async function openStore(): Promise<KeyValueStore> {
  if (!isIndexedDbSupported()) return createMemoryStore();
  try {
    return await openIndexedDbStore();
  } catch (error) {
    console.warn(error);
    return createMemoryStore();
  }
}

function storyTitle(story: CompiledStory, locale: Locale): string {
  const { title } = story.project;
  return title[locale] || title.en || title.tr || '';
}

/** Builds the reader shell, wires it to a kernel, and returns the running kernel. */
export async function startPlayer(root: HTMLElement): Promise<Kernel> {
  let settings = loadSettings();
  let t = createTranslator(messages, settings.locale);
  const kernel = new Kernel();
  const hud = new PerfHud(settings.locale);
  const runAsync = (id: string, params?: unknown, source = 'player.ui') =>
    kernel.actions.run(id, params, { source });
  const run = (id: string, params?: unknown, source?: string) => {
    runAsync(id, params, source).catch((error: unknown) => console.error(error));
  };
  let story: StoryController | null = null;
  let screens: ScreenHost | null = null;
  const engine = new AudioEngine();
  const audio = new AudioDirector({
    engine,
    // Imported files live in the Studio's own storage; a published novel plays catalogue links.
    resolve: (track) => Promise.resolve(track.source.kind === 'url' ? track.source.url : null),
    library: () => story?.session.story.project.audio,
    characters: () => story?.session.story.project.characters ?? [],
  });
  engine.unlockOnGesture(document, () => story?.syncScene());
  // The GPU stage is built only when the novel first uses it (ADR 0015).
  const stage = createStageHost({
    root: () => story?.presenter.element ?? null,
    locale: () => settings.locale,
    beatPhase: () => audio.beatPhase(),
    beat: () => audio.beatInfo(),
    materials: () => story?.session.story.project.materials,
  });
  // Fights and minigames load their code on first use (ADR 0022).
  const fights = new LazyRunner<FightBeat>(async () => {
    const { FightRunner } = await import('@ie/rhythm');
    return new FightRunner({
      audio,
      stage,
      host: () => document.body,
      settings: () => ({
        locale: settings.locale,
        assist: ASSISTS[settings.fightAssist],
        haptics: settings.haptics,
        tapLatency: 0, // the Player has no tap-timing test yet
      }),
      dispatch: (id, params) => run(id, params, 'story'),
      resolve: (result) => run('story.fight', result),
    });
  });
  // Minigames (ADR 0021); the fight-assist setting eases them too.
  const minigames = new LazyRunner<MinigameBeat>(async () => {
    const { MinigameRunner } = await import('@ie/minigame');
    return new MinigameRunner({
      host: () => document.body,
      settings: () => ({
        locale: settings.locale,
        relaxed: settings.fightAssist !== 'off',
        haptics: settings.haptics,
      }),
      resolve: (result) => run('story.minigame', result),
    });
  });
  // Sequences the story plays (ADR 0019); their cues go through the action bus like blocks.
  const sequences = new SequenceRunner({
    audio,
    dispatch: (id, params) => run(id, params, 'story'),
    done: () => run('story.advance'),
  });
  let hyphenate: PresenterOptions['hyphenate'];
  const hyphenation = loadHyphenators().then(
    (engines) => {
      hyphenate = (text, locale) => engines[locale](text);
      return true;
    },
    (error: unknown) => {
      console.warn(error); // the story still reads fine, just without hyphens
      return false;
    },
  );
  const presenterOptions = (s: PlayerSettings): PresenterOptions => ({
    locale: s.locale,
    speed: s.textSpeed,
    timers: s.timers,
    ...(hyphenate ? { hyphenate } : {}),
  });

  /** A tap on the page: finish the line being typed, or move on. */
  const tap = () => {
    if (!story || menu.isOpen || screens?.covering) return;
    if (story.presenter.busy) story.presenter.skip();
    else if (story.session.canAdvance) run('story.advance');
  };
  // Timed choices wait while the menu, a sheet, or another app covers the page.
  const holdClocks = () =>
    story?.presenter.hold(
      menu.isOpen || dialogs.isOpen || document.hidden || screens?.covering === true,
    );

  const reader = new Reader(t, tap);
  const dialogs = new Dialogs(t, {
    getSettings: () => settings,
    run,
    runAsync,
    story: () => story,
    hyphenate: () => hyphenate,
    onToggle: holdClocks,
  });
  const menu = new Menu(
    t,
    {
      close: () => run('ui.menu.set', { open: false }),
      back: () => {
        run('ui.menu.set', { open: false });
        run('story.back');
      },
      openPanel: (panel) => {
        run('ui.menu.set', { open: false });
        run('ui.panel.open', { panel });
      },
      hasSheet: () => (story ? hasSheet(story.session.runtime.story) : false),
      screens: () =>
        (screens?.panels ?? []).map((s) => ({
          id: s.id,
          label: s.name[settings.locale] || s.name.en || s.name.tr || '',
        })),
      openScreen: (id) => {
        run('ui.menu.set', { open: false });
        screens?.open(id);
      },
      shelf: () => location.assign(novelUrl(null)),
    },
    () => run('ui.menu.set', { open: !menu.isOpen }),
  );

  const apply = (next: PlayerSettings) => {
    const localeChanged = next.locale !== settings.locale;
    settings = next;
    saveSettings(next);
    applyTheme(next.theme);
    // The author's look sits on top of the reader's Paper/Night, unless the reader turned it off
    // or asked for high contrast (which needs the reader's own, tested colours).
    const ownLook = next.storyLook && next.contrast !== 'high';
    const look = story && ownLook ? story.session.story.project.theme : undefined;
    applyStoryTheme(document.documentElement, look ? resolveStoryTheme(look) : null);
    stage.refreshPalette();
    document.documentElement.lang = LOCALE_INFO[next.locale].tag;
    applyAccess(document.documentElement, next);
    hud.setLocale(next.locale);
    for (const bus of VOLUME_BUSES) engine.setVolume(bus, next.volumes[bus]);
    if (next.hud && !hud.mounted) hud.mount();
    if (!next.hud && hud.mounted) hud.unmount();
    if (localeChanged) {
      t = createTranslator(messages, next.locale);
      screens?.setLocale(next.locale);
    }
    // The story redraws the page in the new language, mid-scene, keeping any running clock.
    story?.presenter.setOptions(presenterOptions(next));
    if (story) document.title = storyTitle(story.session.story, next.locale);
    reader.render(t);
    menu.render(t);
    dialogs.render(t);
    shelf?.render(t);
  };

  kernel.use(
    createShellModule({
      getSettings: () => settings,
      applySettings: apply,
      openPanel: (panel) => dialogs.open(panel),
      setMenuOpen: (open) => {
        menu.setOpen(open);
        holdClocks();
      },
    }),
  );
  kernel.use(createStoryModule(() => story));
  kernel.use(createAudioModule(audio));
  kernel.use(createStageModule(stage));
  kernel.use(createSequenceModule(sequences, () => story?.session.story.project));
  await kernel.start();

  root.replaceChildren(reader.element, menu.trigger, menu.element);

  const store = await openStore();
  const loaded = await openStory(store);
  let shelf: ReturnType<typeof mountShelf> | null = null;
  if ('shelf' in loaded) {
    shelf = mountShelf(root, loaded.shelf, t, {
      store,
      openSettings: () => run('ui.panel.open', { panel: 'settings' }),
    });
  } else if (loaded instanceof StoryLoadError) {
    reader.showError(
      t('story.error'),
      loaded.problems.map((p) => p.message),
    );
  } else {
    const session = await StorySession.open(loaded, store, {
      runAction: (id, params) => run(id, params, 'story'),
    });
    const presenter = new StoryPresenter(
      session.runtime,
      {
        choose: (optionId) => run('story.choose', { optionId }),
        submit: (answer) => run('story.submit', { answer }),
        advance: () => run('story.advance'),
        restart: () => run('story.restart'),
        buy: (itemId) => run('story.buy', { itemId }),
        sell: (itemId) => run('story.sell', { itemId }),
        leaveShop: () => run('story.leaveShop'),
        battle: (action) => run('story.battle', action),
        typed: (speaker, text) => audio.typed(speaker, text),
        fight: (beat) => fights.start(session.runtime, beat),
        minigame: (beat) => minigames.start(session.runtime, beat),
        sequence: (beat) => sequences.start(session.runtime, beat),
      },
      presenterOptions(settings),
    );
    story = new StoryController(session, presenter, kernel.events, (scene) => {
      fights.sync(session.runtime);
      minigames.sync(session.runtime);
      sequences.sync(session.runtime);
      audio.applyScene(scene);
      stage.applyScene(scene);
    });
    const begin = () => {
      story?.begin();
      if (session.runtime.log.length <= 2) reader.showHint(); // still on the very first line
    };
    screens = new ScreenHost(
      session.runtime,
      {
        start: () => (session.hasProgress ? run('story.restart') : begin()),
        continue: begin,
        menu: (panel) => run('ui.panel.open', { panel }),
        changed: () => {
          session.commit();
          story?.presenter.redraw();
        },
        toggled: holdClocks,
      },
      { locale: settings.locale, canContinue: () => session.hasProgress },
    );
    story.useScreens(screens);
    reader.mount(presenter.element);
    reader.element.before(screens.hudTop);
    reader.element.after(screens.hudBottom);
    root.append(screens.overlay);
    menu.render(t);
    // The patterns are small and usually cached: wait briefly so the first page is hyphenated.
    await Promise.race([hyphenation, new Promise((resolve) => setTimeout(resolve, 500))]);
    presenter.setOptions(presenterOptions(settings));
    if (!screens.showTitle()) begin();
    void hyphenation.then(() => story?.presenter.setOptions(presenterOptions(settings)));
  }
  apply(settings);

  // Clicking the page while the menu is open just closes it.
  reader.element.addEventListener(
    'click',
    (event) => {
      if (!menu.isOpen) return;
      event.stopImmediatePropagation();
      run('ui.menu.set', { open: false });
    },
    { capture: true },
  );

  document.addEventListener('keydown', (event) => {
    if (dialogs.isOpen || event.defaultPrevented || shelf) return;
    const target = event.target instanceof Element ? event.target : null;
    if (event.key === 'Escape') {
      if (screens?.showing === 'panel') screens.close();
      else run('ui.menu.set', { open: !menu.isOpen });
      return;
    }
    // A fight or a minigame reads its own keys (arrows act there, not step back).
    if (menu.isOpen || fights.running || minigames.running || screens?.covering) return;
    if (target?.closest('input, textarea, select')) return;
    if (event.key === '`') {
      run('ui.hud.set', { visible: !settings.hud });
    } else if (story?.presenter.handleKey(event.key)) {
      event.preventDefault();
    } else if (BACK_KEYS.has(event.key)) {
      event.preventDefault();
      run('story.back');
    } else if (ADVANCE_KEYS.has(event.key)) {
      // Enter or Space on a focused button presses that button instead.
      if ((event.key === 'Enter' || event.key === ' ') && target?.closest('button')) return;
      event.preventDefault();
      tap();
    }
  });

  document.addEventListener('visibilitychange', holdClocks);
  watchSystemTheme(() => {
    if (settings.theme === 'system') applyTheme('system');
    stage.refreshPalette();
  });

  if (location.hash === '#diagnostics') run('ui.panel.open', { panel: 'diagnostics' });
  return kernel;
}
