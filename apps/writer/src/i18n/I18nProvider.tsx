// App-wide language: resolves the writer setting against the device locales (expo-localization),
// exposes `t` / `formatNumber` / `formatDate`, and persists the override in app-settings.
import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { loadSettings, saveSettings } from '../settings/app-settings.ts';
import { useRepository } from '../store/context.tsx';
import {
  formatDate as fmtDate,
  formatNumber as fmtNumber,
  resolveLocale,
  translator,
  type LanguageSetting,
  type Locale,
  type Translate,
} from './i18n.ts';

export interface I18nValue {
  locale: Locale;
  setting: LanguageSetting;
  t: Translate;
  formatNumber(n: number): string;
  formatDate(iso: string): string;
  setLanguage(next: LanguageSetting): void;
}

function deviceLocales(): readonly { languageCode: string | null }[] {
  try {
    return getLocales();
  } catch {
    return [];
  }
}

const make = (setting: LanguageSetting, setLanguage: I18nValue['setLanguage']): I18nValue => {
  const locale = resolveLocale(setting, deviceLocales());
  return {
    locale,
    setting,
    t: translator(locale),
    formatNumber: (n) => fmtNumber(n, locale),
    formatDate: (iso) => fmtDate(iso, locale),
    setLanguage,
  };
};

const I18nContext = createContext<I18nValue>(make('en', () => undefined));

export function I18nProvider({ children }: { children: ReactNode }): ReactNode {
  const repo = useRepository();
  const [setting, setSetting] = useState<LanguageSetting>('system');
  useEffect(() => {
    let live = true;
    void loadSettings(repo)
      .then((s) => live && setSetting(s.language))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [repo]);
  const setLanguage = useCallback(
    (next: LanguageSetting): void => {
      setSetting(next);
      void saveSettings(repo, { language: next }).catch(() => undefined);
    },
    [repo],
  );
  const value = useMemo(() => make(setting, setLanguage), [setting, setLanguage]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = (): I18nValue => useContext(I18nContext);
