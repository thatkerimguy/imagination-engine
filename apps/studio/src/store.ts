import { createTranslator, detectLocale, isLocale, type Locale, type Translator } from '@ie/i18n';
import { isThemePreference, readPref, writePref, type ThemePreference } from '@ie/ui-kit';
import { useMemo } from 'react';
import { create } from 'zustand';
import { messages, type MessageKey } from './messages.ts';
import { isViewId, type ViewId } from './views.ts';

const KEYS = {
  locale: 'ie.studio.locale',
  theme: 'ie.studio.theme',
  hud: 'ie.studio.hud',
  view: 'ie.studio.view',
} as const;

export interface StudioState {
  view: ViewId;
  locale: Locale;
  theme: ThemePreference;
  hud: boolean;
  paletteOpen: boolean;
  moreOpen: boolean;
  // Arrow-typed so components can pull them out of the store without binding.
  setView: (view: ViewId) => void;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemePreference) => void;
  setHud: (visible: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  setMoreOpen: (open: boolean) => void;
}

function initialState() {
  const locale = readPref(KEYS.locale);
  const theme = readPref(KEYS.theme);
  const view = readPref(KEYS.view);
  // A view in the URL hash wins, so `pnpm phone --studio --diag` can link straight to a workspace.
  const linked = location.hash.slice(1);
  return {
    view: isViewId(linked) ? linked : isViewId(view) ? view : 'write',
    locale: isLocale(locale) ? locale : detectLocale(),
    theme: isThemePreference(theme) ? theme : 'system',
    hud: new URLSearchParams(location.search).has('hud') || readPref(KEYS.hud) === 'on',
  } as const;
}

export const useStudio = create<StudioState>()((set) => ({
  ...initialState(),
  paletteOpen: false,
  moreOpen: false,
  setView: (view) => {
    writePref(KEYS.view, view);
    set({ view, moreOpen: false });
  },
  setLocale: (locale) => {
    writePref(KEYS.locale, locale);
    set({ locale });
  },
  setTheme: (theme) => {
    writePref(KEYS.theme, theme);
    set({ theme });
  },
  setHud: (hud) => {
    writePref(KEYS.hud, hud ? 'on' : 'off');
    set({ hud });
  },
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setMoreOpen: (moreOpen) => set({ moreOpen }),
}));

/** Translator for the current Studio language. */
export function useT(): Translator<MessageKey> {
  const locale = useStudio((s) => s.locale);
  return useMemo(() => createTranslator(messages, locale), [locale]);
}
