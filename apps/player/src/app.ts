import { Kernel } from '@ie/core';
import { PerfHud } from '@ie/diagnostics';
import { LOCALE_INFO, createTranslator } from '@ie/i18n';
import { applyTheme, watchSystemTheme } from '@ie/ui-kit';
import { Dialogs } from './dialogs.ts';
import { Menu } from './menu.ts';
import { messages } from './messages.ts';
import { Reader } from './reader.ts';
import { TEXT_SCALE, loadSettings, saveSettings, type PlayerSettings } from './settings.ts';
import { createShellModule } from './shell-module.ts';

const ADVANCE_KEYS = new Set([' ', 'Enter', 'ArrowRight', 'ArrowDown', 'PageDown']);

/** Builds the reader shell, wires it to a kernel, and returns the running kernel. */
export async function startPlayer(root: HTMLElement): Promise<Kernel> {
  let settings = loadSettings();
  let t = createTranslator(messages, settings.locale);
  const kernel = new Kernel();
  const hud = new PerfHud(settings.locale);
  const run = (id: string, params: unknown) => {
    kernel.actions
      .run(id, params, { source: 'player.ui' })
      .catch((error: unknown) => console.error(error));
  };

  const reader = new Reader(t);
  const dialogs = new Dialogs(t, { getSettings: () => settings, run });
  const menu = new Menu(
    t,
    {
      close: () => run('ui.menu.set', { open: false }),
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
    reader.render(t);
    menu.render(t);
    dialogs.render(t);
  };

  kernel.use(
    createShellModule({
      getSettings: () => settings,
      applySettings: apply,
      openPanel: (panel) => dialogs.open(panel),
      setMenuOpen: (open) => menu.setOpen(open),
    }),
  );
  await kernel.start();

  root.replaceChildren(reader.element, menu.trigger, menu.element);
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
    if (event.key === 'Escape') {
      run('ui.menu.set', { open: !menu.isOpen });
    } else if (event.key === '`') {
      run('ui.hud.set', { visible: !settings.hud });
    } else if (!menu.isOpen && ADVANCE_KEYS.has(event.key)) {
      event.preventDefault();
      reader.advance();
    }
  });

  watchSystemTheme(() => {
    if (settings.theme === 'system') applyTheme('system');
  });

  if (location.hash === '#diagnostics') run('ui.panel.open', { panel: 'diagnostics' });
  return kernel;
}
