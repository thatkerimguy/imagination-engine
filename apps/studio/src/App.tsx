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
import { DataView } from './views/DataView.tsx';
import { DesignView } from './views/DesignView.tsx';
import { EmptyView } from './views/EmptyView.tsx';
import { LibraryView } from './views/LibraryView.tsx';
import { PublishView } from './views/PublishView.tsx';
import { LogicView } from './views/LogicView.tsx';
import { FlowView } from './views/FlowView.tsx';
import { PlayView } from './views/PlayView.tsx';
import { MaterialsView } from './views/MaterialsView.tsx';
import { SequencerView } from './views/SequencerView.tsx';
import { SettingsView } from './views/SettingsView.tsx';
import { SoundView } from './views/SoundView.tsx';
import { StageView } from './views/StageView.tsx';
import { WriteView } from './views/WriteView.tsx';

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
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === 'k') {
        event.preventDefault();
        state.setPaletteOpen(!state.paletteOpen);
      } else if (mod && !event.altKey && (key === 'z' || key === 'y')) {
        // The novel's own history replaces the browser's per-field undo, so one Undo works
        // the same in a text line, a dropdown or after deleting a block.
        event.preventDefault();
        runAction(key === 'y' || event.shiftKey ? 'project.redo' : 'project.undo');
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
  if (view === 'write') return <WriteView />;
  if (view === 'flow') return <FlowView />;
  if (view === 'play') return <PlayView />;
  if (view === 'data') return <DataView />;
  if (view === 'sound') return <SoundView />;
  if (view === 'stage') return <StageView />;
  if (view === 'sequencer') return <SequencerView />;
  if (view === 'materials') return <MaterialsView />;
  if (view === 'logic') return <LogicView />;
  if (view === 'design') return <DesignView />;
  if (view === 'library') return <LibraryView />;
  if (view === 'publish') return <PublishView />;
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
