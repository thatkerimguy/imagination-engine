import { LOCALES, upper } from '@ie/i18n';
import { THEME_PREFERENCES, type ThemePreference } from '@ie/ui-kit';
import { Monitor, Moon, Search, Sun } from 'lucide-react';
import { runAction } from '../kernel.ts';
import { useStudio, useT } from '../store.ts';
import { Segmented } from './Segmented.tsx';

const THEME_ICON = { system: Monitor, paper: Sun, night: Moon } as const;

function nextTheme(theme: ThemePreference): ThemePreference {
  const index = THEME_PREFERENCES.indexOf(theme);
  return THEME_PREFERENCES[(index + 1) % THEME_PREFERENCES.length] ?? 'system';
}

export function TopBar() {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const theme = useStudio((s) => s.theme);
  const setPaletteOpen = useStudio((s) => s.setPaletteOpen);
  const ThemeIcon = THEME_ICON[theme];
  const themeLabel = t('cmd.theme', { theme: t(`settings.theme.${theme}`) });
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="topbar">
      <h1 className="topbar__title">{t('app.untitled')}</h1>
      <div className="topbar__actions">
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
          className="ie-button ie-button--quiet topbar__icon"
          aria-label={themeLabel}
          title={themeLabel}
          onClick={() => runAction('ui.theme.set', { theme: nextTheme(theme) })}
        >
          <ThemeIcon size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
