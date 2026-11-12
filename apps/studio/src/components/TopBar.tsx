import { LOCALES, upper } from '@ie/i18n';
import { THEME_PREFERENCES, type ThemePreference } from '@ie/ui-kit';
import { ChevronDown, Monitor, Moon, Redo2, Search, Sun, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { runAction } from '../kernel.ts';
import { useDoc, useProject } from '../project/store.ts';
import { useStudio, useT } from '../store.ts';
import { labelText } from '../write/edit.ts';
import { ProjectSheet } from './ProjectSheet.tsx';
import { Segmented } from './Segmented.tsx';

const THEME_ICON = { system: Monitor, paper: Sun, night: Moon } as const;

function nextTheme(theme: ThemePreference): ThemePreference {
  const index = THEME_PREFERENCES.indexOf(theme);
  return THEME_PREFERENCES[(index + 1) % THEME_PREFERENCES.length] ?? 'system';
}

export function TopBar() {
  const t = useT();
  const doc = useDoc();
  const locale = useStudio((s) => s.locale);
  const theme = useStudio((s) => s.theme);
  const setPaletteOpen = useStudio((s) => s.setPaletteOpen);
  const canUndo = useProject((s) => (s.history?.past.length ?? 0) > 0);
  const canRedo = useProject((s) => (s.history?.future.length ?? 0) > 0);
  const saveState = useProject((s) => s.saveState);
  const [sheet, setSheet] = useState(false);
  const ThemeIcon = THEME_ICON[theme];
  const themeLabel = t('cmd.theme', { theme: t(`settings.theme.${theme}`) });
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const mod = isMac ? '⌘' : 'Ctrl+';

  return (
    <header className="topbar">
      <div className="topbar__start">
        <button
          type="button"
          className="topbar__title"
          aria-haspopup="dialog"
          data-testid="project-button"
          onClick={() => setSheet(true)}
        >
          <span className="topbar__name">{labelText(doc.title, locale, t('app.untitled'))}</span>
          <ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <span
          className="topbar__save"
          data-state={saveState}
          data-testid="save-state"
          role="status"
          title={saveState === 'invalid' ? t('save.invalidHint') : undefined}
        >
          {t(`save.${saveState}`)}
        </span>
      </div>
      <div className="topbar__actions">
        <button
          type="button"
          className="ie-button ie-button--quiet topbar__icon"
          aria-label={t('edit.undo')}
          title={`${t('edit.undo')} (${mod}Z)`}
          disabled={!canUndo}
          data-testid="undo"
          onClick={() => runAction('project.undo')}
        >
          <Undo2 size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="ie-button ie-button--quiet topbar__icon"
          aria-label={t('edit.redo')}
          title={`${t('edit.redo')} (${isMac ? '⇧⌘Z' : 'Ctrl+Y'})`}
          disabled={!canRedo}
          data-testid="redo"
          onClick={() => runAction('project.redo')}
        >
          <Redo2 size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="ie-button ie-button--quiet topbar__palette"
          aria-label={t('palette.open')}
          data-testid="palette-button"
          onClick={() => setPaletteOpen(true)}
        >
          <Search size={16} strokeWidth={1.5} aria-hidden="true" />
          <kbd className="ie-kbd topbar__kbd">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
        <Segmented
          className="topbar__lang"
          label={t('settings.language')}
          // Short codes keep the bar compact; the full names are in Settings and the palette.
          options={LOCALES.map((l) => ({ value: l, label: upper(l, 'en') }))}
          value={locale}
          onChange={(l) => runAction('ui.locale.set', { locale: l })}
        />
        <button
          type="button"
          className="ie-button ie-button--quiet topbar__icon topbar__theme"
          aria-label={themeLabel}
          title={themeLabel}
          onClick={() => runAction('ui.theme.set', { theme: nextTheme(theme) })}
        >
          <ThemeIcon size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      {sheet && <ProjectSheet onClose={() => setSheet(false)} />}
    </header>
  );
}
