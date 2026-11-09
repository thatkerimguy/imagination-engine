import { PerfHud } from '@ie/diagnostics';
import { localeTag } from '@ie/i18n';
import { applyTheme, watchSystemTheme } from '@ie/ui-kit';
import { useEffect, useRef } from 'react';
import { CommandPalette } from './components/CommandPalette.tsx';
import { Rail } from './components/Rail.tsx';
import { TabBar } from './components/TabBar.tsx';
import { TopBar } from './components/TopBar.tsx';
import { runAction } from './kernel.ts';
import { useStudio, useT } from './store.ts';
import { VIEWS } from './views.ts';
import { DiagnosticsView } from './views/DiagnosticsView.tsx';
import { EmptyView } from './views/EmptyView.tsx';
import { SettingsView } from './views/SettingsView.tsx';

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

/** Keeps <html> (theme, language, title) and the performance overlay in step with the store. */
function useDocumentSync() {
  const t = useT();
  const theme = useStudio((s) => s.theme);
  const locale = useStudio((s) => s.locale);
  const view = useStudio((s) => s.view);
  const hud = useStudio((s) => s.hud);
  const hudRef = useRef<PerfHud | null>(null);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    return watchSystemTheme(() => applyTheme('system'));
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = localeTag(locale);
    document.title = `${t(VIEWS[view].label)} · ${t('app.name')}`;
  }, [t, locale, view]);

  useEffect(() => {
    if (!hud) return;
    const overlay = new PerfHud(locale);
    overlay.mount();
    hudRef.current = overlay;
    return () => {
      overlay.unmount();
      hudRef.current = null;
    };
    // The overlay follows language changes through setLocale below instead of remounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hud]);

  useEffect(() => hudRef.current?.setLocale(locale), [locale]);
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = useStudio.getState();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        state.setPaletteOpen(!state.paletteOpen);
      } else if (event.key === '`' && !isTyping(event.target)) {
        runAction('ui.hud.set', { visible: !state.hud });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function CurrentView() {
  const view = useStudio((s) => s.view);
  if (view === 'settings') return <SettingsView />;
  if (view === 'diagnostics') return <DiagnosticsView />;
  return <EmptyView key={view} info={VIEWS[view]} />;
}

export function App() {
  const paletteOpen = useStudio((s) => s.paletteOpen);
  useDocumentSync();
  useShortcuts();

  return (
    <div className="studio">
      <Rail />
      <TopBar />
      <main className="studio__main">
        <CurrentView />
      </main>
      <TabBar />
      {paletteOpen && <CommandPalette />}
    </div>
  );
}
