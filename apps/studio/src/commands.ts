import { LOCALES, LOCALE_INFO, matchesSearch, type Translator } from '@ie/i18n';
import { THEME_PREFERENCES } from '@ie/ui-kit';
import type { MessageKey } from './messages.ts';
import { VIEWS, VIEW_IDS } from './views.ts';

/** A palette entry. Commands only name an action; the palette runs it through the action bus. */
export interface Command {
  readonly id: string;
  readonly label: string;
  readonly action: string;
  readonly params: Readonly<Record<string, unknown>>;
}

export interface CommandContext {
  readonly hud: boolean;
}

export function buildCommands(t: Translator<MessageKey>, ctx: CommandContext): Command[] {
  const views = VIEW_IDS.map((view) => ({
    id: `goto.${view}`,
    label: t('cmd.goto', { view: t(VIEWS[view].label) }),
    action: 'studio.view.open',
    params: { view },
  }));
  const themes = THEME_PREFERENCES.map((theme) => ({
    id: `theme.${theme}`,
    label: t('cmd.theme', { theme: t(`settings.theme.${theme}`) }),
    action: 'ui.theme.set',
    params: { theme },
  }));
  const languages = LOCALES.map((locale) => ({
    id: `language.${locale}`,
    label: t('cmd.language', { language: LOCALE_INFO[locale].nativeName }),
    action: 'ui.locale.set',
    params: { locale },
  }));
  const hud = {
    id: 'hud.toggle',
    label: t('cmd.hud'),
    action: 'ui.hud.set',
    params: { visible: !ctx.hud },
  };
  return [...views, ...themes, ...languages, hud];
}

/** Turkish-aware, accent-insensitive filter: "akis" finds "Akış", "diger" finds "Diğer". */
export function filterCommands(commands: readonly Command[], query: string): Command[] {
  if (!query.trim()) return [...commands];
  return commands.filter((command) => matchesSearch(command.label, query));
}
