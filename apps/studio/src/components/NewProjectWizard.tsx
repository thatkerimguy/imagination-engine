import type { Locale } from '@ie/i18n';
import { KITS, type Kit } from '@ie/kits';
import { THEME_PRESETS, type Label, type ThemePreset } from '@ie/story';
import { useState } from 'react';
import { PresetSwatch, ThemePreview } from '../design/ThemeEditor.tsx';
import { UNTITLED } from '../messages.ts';
import { adoptProject } from '../project/store.ts';
import { wizardProject } from '../project/wizard.ts';
import { useStudio, useT } from '../store.ts';
import { labelText } from '../write/edit.ts';
import { Segmented } from './Segmented.tsx';

const LANGUAGES = { both: ['en', 'tr'], en: ['en'], tr: ['tr'] } as const satisfies Record<
  string,
  readonly Locale[]
>;
type Languages = keyof typeof LANGUAGES;

/**
 * New novel in three steps: what kind of story (a kit, or blank), how it looks, and its name and
 * languages. Every step has a sensible default, so Next, Next, Create works.
 */
export function NewProjectWizard({
  onCreated,
  onCancel,
}: {
  readonly onCreated: () => void;
  readonly onCancel: () => void;
}) {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const [step, setStep] = useState(1);
  const [kit, setKit] = useState<Kit | null>(null);
  const [preset, setPreset] = useState<ThemePreset>('auto');
  const [title, setTitle] = useState<Label>({});
  const [languages, setLanguages] = useState<Languages>('both');

  const pickKit = (next: Kit | null) => {
    setKit(next);
    setPreset(next?.theme ?? 'auto');
  };
  const create = () =>
    void adoptProject(
      wizardProject(kit, preset, title, LANGUAGES[languages], t('passage.first')),
    ).then(onCreated);

  return (
    <div className="wizard" data-testid="wizard">
      <p className="hint">{t('wizard.step', { n: step })}</p>
      {step === 1 && (
        <>
          <h3 className="card__title">{t('wizard.kitStep')}</h3>
          <div className="wizard__options">
            <button
              type="button"
              className="wizard__option"
              aria-pressed={kit === null}
              data-testid="wizard-kit-blank"
              onClick={() => pickKit(null)}
            >
              <span className="wizard__name">{t('wizard.blank')}</span>
              <span className="hint">{t('wizard.blankBlurb')}</span>
            </button>
            {KITS.map((k) => (
              <button
                key={k.id}
                type="button"
                className="wizard__option"
                aria-pressed={kit?.id === k.id}
                data-testid={`wizard-kit-${k.id}`}
                onClick={() => pickKit(k)}
              >
                <span className="wizard__name">{labelText(k.name, locale)}</span>
                <span className="hint">{labelText(k.blurb, locale)}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <h3 className="card__title">{t('wizard.themeStep')}</h3>
          <div className="theme-presets" role="group" aria-label={t('theme.preset')}>
            {THEME_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className="theme-preset"
                aria-pressed={preset === p}
                data-testid={`wizard-theme-${p}`}
                onClick={() => setPreset(p)}
              >
                <PresetSwatch preset={p} />
                <span>{t(`preset.${p}`)}</span>
              </button>
            ))}
          </div>
          {kit && (
            <p className="hint">{t('wizard.suggested', { preset: t(`preset.${kit.theme}`) })}</p>
          )}
          <ThemePreview theme={{ preset }} />
        </>
      )}
      {step === 3 && (
        <>
          <h3 className="card__title">{t('wizard.finishStep')}</h3>
          <div className="card__grid">
            {(['en', 'tr'] as const).map((lang) => (
              <label className="labelled" key={lang}>
                <span className="ie-label">
                  {t(lang === 'en' ? 'project.nameEn' : 'project.nameTr')}
                </span>
                <input
                  className="field"
                  lang={lang}
                  value={title[lang] ?? ''}
                  placeholder={UNTITLED[lang]}
                  data-testid={`wizard-name-${lang}`}
                  onChange={(e) => setTitle((old) => ({ ...old, [lang]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <span className="ie-label">{t('wizard.languages')}</span>
          <Segmented
            label={t('wizard.languages')}
            value={languages}
            options={(['both', 'en', 'tr'] as const).map((value) => ({
              value,
              label: t(`wizardLang.${value}`),
            }))}
            onChange={setLanguages}
          />
        </>
      )}
      <div className="wizard__foot">
        <button
          type="button"
          className="ie-button ie-button--quiet"
          onClick={() => (step === 1 ? onCancel() : setStep(step - 1))}
        >
          {step === 1 ? t('cancel') : t('wizard.back')}
        </button>
        {step < 3 ? (
          <button
            type="button"
            className="ie-button ie-button--primary"
            data-testid="wizard-next"
            onClick={() => setStep(step + 1)}
          >
            {t('wizard.next')}
          </button>
        ) : (
          <button
            type="button"
            className="ie-button ie-button--primary"
            data-testid="wizard-create"
            onClick={create}
          >
            {t('wizard.create')}
          </button>
        )}
      </div>
    </div>
  );
}
