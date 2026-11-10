import { MATERIAL_LIMITS, type MaterialDef, type MaterialParam } from '@ie/story';
import { Plus, Trash2 } from 'lucide-react';
import { stage } from '../stage/studio-stage.ts';
import { useStudio, useT } from '../store.ts';
import { labelText } from '../write/edit.ts';
import { addParam, removeParam, updateParam } from './edit.ts';

function Num({
  value,
  label,
  onChange,
}: {
  readonly value: number;
  readonly label: string;
  readonly onChange: (n: number) => void;
}) {
  return (
    <label className="labelled mat-param__num">
      <span>{label}</span>
      <input
        className="field field--number"
        type="number"
        step={0.1}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </label>
  );
}

/**
 * A material's parameters (ADR 0020): names in each language, a range and a default. "Try" moves
 * the preview's live value without changing the project, the way the sequencer would.
 */
export function Params({
  material,
  onEdit,
}: {
  readonly material: MaterialDef;
  readonly onEdit: (change: (m: MaterialDef) => MaterialDef, mergeKey?: string) => void;
}) {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const languages = ['en', 'tr'] as const;
  const patch = (p: MaterialParam, change: Partial<Omit<MaterialParam, 'id'>>, key: string) =>
    onEdit((m) => updateParam(m, p.id, change), `param:${p.id}:${key}`);

  return (
    <fieldset className="mat-params" data-testid="mat-params">
      <legend>{t('mat.params')}</legend>
      <p className="hint">{t('mat.paramsHint')}</p>
      {material.params.map((p) => (
        <div key={p.id} className="mat-param" data-testid="mat-param">
          <div className="row row--wrap">
            {languages.map((language) => (
              <label key={language} className="labelled">
                <span>{t('mat.name', { language: t(`language.${language}`) })}</span>
                <input
                  className="field"
                  lang={language}
                  value={p.name[language] ?? ''}
                  onChange={(e) =>
                    patch(p, { name: { ...p.name, [language]: e.target.value } }, language)
                  }
                />
              </label>
            ))}
          </div>
          <div className="row row--wrap">
            <Num
              value={p.default}
              label={t('mat.default')}
              onChange={(v) => patch(p, { default: v }, 'd')}
            />
            <Num value={p.min} label={t('mat.min')} onChange={(v) => patch(p, { min: v }, 'min')} />
            <Num value={p.max} label={t('mat.max')} onChange={(v) => patch(p, { max: v }, 'max')} />
          </div>
          <div className="row row--wrap">
            <label className="inline-field mat-param__try">
              <span>{t('mat.try', { name: labelText(p.name, locale, p.id) })}</span>
              <input
                type="range"
                min={p.min}
                max={p.max}
                step={(p.max - p.min) / 100 || 0.01}
                defaultValue={p.default}
                data-testid="mat-param-try"
                onChange={(e) =>
                  stage.materialParam({
                    material: material.id,
                    param: p.id,
                    value: Number(e.target.value),
                  })
                }
              />
            </label>
            <button
              type="button"
              className="ie-button ie-button--quiet"
              onClick={() => onEdit((m) => removeParam(m, p.id))}
            >
              <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
              {t('mat.removeParam')}
            </button>
          </div>
        </div>
      ))}
      {material.params.length < MATERIAL_LIMITS.params && (
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-testid="mat-add-param"
          onClick={() => {
            const name = t('mat.paramBase');
            onEdit((m) => addParam(m, { en: name, tr: name }).material);
          }}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('mat.addParam')}
        </button>
      )}
    </fieldset>
  );
}
