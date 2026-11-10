import {
  Kernel,
  createMemoryStore,
  isIndexedDbSupported,
  openIndexedDbStore,
  type KeyValueStore,
} from '@ie/core';
import { PerfHud } from '@ie/diagnostics';
import { LOCALE_INFO, createTranslator, loadHyphenators, type Locale } from '@ie/i18n';
import { StoryPresenter, type PresenterOptions } from '@ie/present';
import { samples } from '@ie/samples';
import { StoryLoadError, compileStory, type CompiledStory } from '@ie/story';
import { applyTheme, watchSystemTheme } from '@ie/ui-kit';
import { Dialogs } from './dialogs.ts';
import { Menu } from './menu.ts';
import { messages } from './messages.ts';
import { Reader } from './reader.ts';
import { TEXT_SCALE, loadSettings, saveSettings, type PlayerSettings } from './settings.ts';
import { createShellModule } from './shell-module.ts';
import { StoryController } from './story/controller.ts';
import { createStoryModule } from './story/module.ts';
import { StorySession } from './story/session.ts';

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

/** The bundled sample until the Studio can publish stories to the Player. */
function loadStory(): CompiledStory | StoryLoadError {
  try {
    return compileStory(samples.rainAlley);
  } catch (error) {
    if (error instanceof StoryLoadError) return error;
    throw error;
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
    if (!story || menu.isOpen) return;
    if (story.presenter.busy) story.presenter.skip();
    else if (story.session.canAdvance) run('story.advance');
  };
  // Timed choices wait while the menu, a sheet, or another app covers the page.
  const holdClocks = () => story?.presenter.hold(menu.isOpen || dialogs.isOpen || document.hidden);

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
    },
    () => run('ui.menu.set', { open: !menu.isOpen }),
  );

  const apply = (next: PlayerSettings) => {
    const localeChanged = next.locale !== settings.locale;
    settings = next;
    saveSettings(next);
    applyTheme(next.theme);
    document.documentElement.lang = LOCALE_INFO[next.locale].tag;
    document.documentElement.style.setProperty('--reader-scale', String(TEXT_SCALE[next.textSize]));
    hud.setLocale(next.locale);
    if (next.hud && !hud.mounted) hud.mount();
    if (!next.hud && hud.mounted) hud.unmount();
    if (localeChanged) t = createTranslator(messages, next.locale);
    // The story redraws the page in the new language, mid-scene, keeping any running clock.
    story?.presenter.setOptions(presenterOptions(next));
    if (story) document.title = storyTitle(story.session.story, next.locale);
    reader.render(t);
    menu.render(t);
    dialogs.render(t);
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
  await kernel.start();

  root.replaceChildren(reader.element, menu.trigger, menu.element);

  const loaded = loadStory();
  if (loaded instanceof StoryLoadError) {
    reader.showError(
      t('story.error'),
      loaded.problems.map((p) => p.message),
    );
  } else {
    const session = await StorySession.open(loaded, await openStore(), {
      runAction: (id, params) => run(id, params, 'story'),
    });
    const presenter = new StoryPresenter(
      session.runtime,
      {
        choose: (optionId) => run('story.choose', { optionId }),
        submit: (answer) => run('story.submit', { answer }),
        advance: () => run('story.advance'),
        restart: () => run('story.restart'),
      },
      presenterOptions(settings),
    );
    story = new StoryController(session, presenter, kernel.events);
    reader.mount(presenter.element);
    // The patterns are small and usually cached: wait briefly so the first page is hyphenated.
    await Promise.race([hyphenation, new Promise((resolve) => setTimeout(resolve, 500))]);
    presenter.setOptions(presenterOptions(settings));
    story.begin();
    void hyphenation.then(() => story?.presenter.setOptions(presenterOptions(settings)));
    if (session.runtime.log.length <= 2) reader.showHint(); // still on the very first line
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
    if (dialogs.isOpen || event.defaultPrevented) return;
    const target = event.target instanceof Element ? event.target : null;
    if (event.key === 'Escape') {
      run('ui.menu.set', { open: !menu.isOpen });
      return;
    }
    if (menu.isOpen || target?.closest('input, textarea, select')) return;
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
  });

  if (location.hash === '#diagnostics') run('ui.panel.open', { panel: 'diagnostics' });
  return kernel;
}
