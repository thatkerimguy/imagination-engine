import { LOCALES, LOCALE_INFO } from '@ie/i18n';
import { THEME_PREFERENCES } from '@ie/ui-kit';
import type { ReactNode } from 'react';
import { Segmented } from '../components/Segmented.tsx';
import { runAction } from '../kernel.ts';
import { useStudio, useT } from '../store.ts';
import { SyncSection } from '../sync/SyncSection.tsx';

function Field({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="ie-field">
      <span className="ie-label">{label}</span>
      {children}
    </div>
  );
}

export function SettingsView() {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const theme = useStudio((s) => s.theme);
  const hud = useStudio((s) => s.hud);

  return (
    <section className="page" data-testid="view-settings">
      <h2 className="page__title">{t('view.settings')}</h2>
      <p className="page__intro">{t('settings.intro')}</p>
      <Field label={t('settings.language')}>
        <Segmented
          label={t('settings.language')}
          options={LOCALES.map((l) => ({ value: l, label: LOCALE_INFO[l].nativeName }))}
          value={locale}
          onChange={(l) => runAction('ui.locale.set', { locale: l })}
        />
      </Field>
      <Field label={t('settings.theme')}>
        <Segmented
          label={t('settings.theme')}
          options={THEME_PREFERENCES.map((v) => ({ value: v, label: t(`settings.theme.${v}`) }))}
          value={theme}
          onChange={(v) => runAction('ui.theme.set', { theme: v })}
        />
      </Field>
      <Field label={t('settings.hud')}>
        <Segmented
          label={t('settings.hud')}
          options={[
            { value: 'off', label: t('settings.off') },
            { value: 'on', label: t('settings.on') },
          ]}
          value={hud ? 'on' : 'off'}
          onChange={(v) => runAction('ui.hud.set', { visible: v === 'on' })}
        />
      </Field>
      <SyncSection />
    </section>
  );
}
