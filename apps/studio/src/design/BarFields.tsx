import type { BarComponent, StoryProject } from '@ie/story';
import { useStudio, useT } from '../store.ts';
import { labelText } from '../write/edit.ts';
import { VariablePicker } from '../write/pickers.tsx';

/** A bar's variable, and what counts as full: a number, or another number variable. */
export function BarFields({
  doc,
  bar,
  onChange,
}: {
  readonly doc: StoryProject;
  readonly bar: BarComponent;
  readonly onChange: (bar: BarComponent, mergeKey?: string) => void;
}) {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const variable = doc.variables.find((v) => v.id === bar.var);
  const numbers = doc.variables.filter((v) => v.type === 'number' && v.id !== bar.var);
  const { maxVar: _maxVar, max: _max, ...plain } = bar;
  return (
    <div className="card__grid">
      <label className="labelled">
        <span className="ie-label">{t('comp.var')}</span>
        <VariablePicker
          doc={doc}
          value={bar.var}
          label={t('comp.var')}
          types={['number']}
          testId="comp-bar-var"
          onChange={(id) => onChange({ ...bar, var: id })}
        />
      </label>
      <label className="labelled">
        <span className="ie-label">{t('comp.maxVar')}</span>
        <select
          className="picker"
          value={bar.maxVar ?? ''}
          onChange={(e) =>
            onChange(e.target.value ? { ...plain, maxVar: e.target.value } : { ...plain })
          }
        >
          <option value="">{t('comp.maxNone')}</option>
          {numbers.map((v) => (
            <option key={v.id} value={v.id}>
              {labelText(v.name, locale, v.id)}
            </option>
          ))}
        </select>
      </label>
      {!bar.maxVar && (
        <label className="labelled">
          <span className="ie-label">{t('comp.max')}</span>
          <input
            className="field"
            type="number"
            min={1}
            inputMode="numeric"
            placeholder={String(variable?.max ?? 100)}
            value={bar.max ?? ''}
            onChange={(e) => {
              const max = Number(e.target.value);
              onChange(max > 0 ? { ...plain, max } : { ...plain }, 'max');
            }}
          />
        </label>
      )}
    </div>
  );
}
