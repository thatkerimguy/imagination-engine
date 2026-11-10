import type { Label, MinigameGame } from '@ie/story';
import { Plus, X } from 'lucide-react';
import { useStudio, useT } from '../store.ts';
import {
  formatParam,
  PARAM_FIELDS,
  paramValue,
  snap,
  withParam,
  type ParamField,
} from './params.ts';

const MAX_WORDS = 8;

function NumberField({
  field,
  game,
  onChange,
}: {
  readonly field: ParamField;
  readonly game: MinigameGame;
  readonly onChange: (game: MinigameGame) => void;
}) {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const value = paramValue(game, field);
  const set = (next: number | undefined) => onChange(withParam(game, field.key, next));
  const testId = `mg-param-${field.key}`;

  if (field.choices) {
    return (
      <label className="labelled mg-param">
        <span className="ie-label">{t(field.label)}</span>
        <select
          className="picker"
          value={String(value)}
          data-testid={testId}
          onChange={(e) => set(Number(e.target.value))}
        >
          {field.choices.map((n) => (
            <option key={n} value={n}>
              {field.key === 'size' ? t('mg.p.sizeValue', { n }) : n}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const off = value === undefined;
  return (
    <div className="labelled mg-param">
      <span className="ie-label">
        {t(field.label)}
        {!off && <output className="mg-param__value">{formatParam(value, field, locale)}</output>}
      </span>
      {field.optional && (
        <label className="check">
          <input
            type="checkbox"
            checked={off}
            data-testid={`${testId}-off`}
            onChange={(e) => set(e.target.checked ? undefined : snap(field.max / 2, field))}
          />
          {t('mg.p.noLimit')}
        </label>
      )}
      {!off && (
        <input
          type="range"
          className="mg-param__range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={value}
          aria-label={t(field.label)}
          data-testid={testId}
          onChange={(e) => set(snap(Number(e.target.value), field))}
        />
      )}
    </div>
  );
}

/** The cipher's words or the typing duel's phrases, each in both languages. */
function WordsField({
  words,
  phrases,
  onChange,
}: {
  readonly words: readonly Label[];
  readonly phrases: boolean;
  readonly onChange: (words: readonly Label[]) => void;
}) {
  const t = useT();
  const set = (index: number, label: Label) =>
    onChange(words.map((word, i) => (i === index ? label : word)));
  return (
    <fieldset className="mg-words" data-testid="mg-words">
      <legend className="ie-label">{t(phrases ? 'mg.phrases' : 'mg.words')}</legend>
      {words.map((word, index) => (
        <div className="mg-words__row" key={index}>
          {(['en', 'tr'] as const).map((locale) => (
            <input
              key={locale}
              className="field"
              lang={locale}
              maxLength={80}
              value={word[locale] ?? ''}
              aria-label={`${t(phrases ? 'mg.phrases' : 'mg.words')} ${index + 1} (${t(
                locale === 'en' ? 'language.en' : 'language.tr',
              )})`}
              placeholder={t(locale === 'en' ? 'language.en' : 'language.tr')}
              data-testid={`mg-word-${index}-${locale}`}
              onChange={(e) => set(index, { ...word, [locale]: e.target.value })}
            />
          ))}
          <button
            type="button"
            className="ie-button ie-button--quiet icon-button"
            aria-label={t('mg.removeWord')}
            title={t('mg.removeWord')}
            disabled={words.length <= 1}
            onClick={() => onChange(words.filter((_, i) => i !== index))}
          >
            <X size={14} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      ))}
      {words.length < MAX_WORDS && (
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-testid="mg-add-word"
          onClick={() => onChange([...words, { en: '', tr: '' }])}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t(phrases ? 'mg.addPhrase' : 'mg.addWord')}
        </button>
      )}
    </fieldset>
  );
}

/** Every parameter of the block's template, as sliders, choices and word lists. */
export function MinigameParams({
  game,
  onChange,
}: {
  readonly game: MinigameGame;
  readonly onChange: (game: MinigameGame) => void;
}) {
  return (
    <div className="mg-params">
      {game.template === 'cipher' && (
        <WordsField
          words={game.words}
          phrases={false}
          onChange={(words) => onChange({ ...game, words })}
        />
      )}
      {game.template === 'typing' && (
        <WordsField
          words={game.phrases}
          phrases
          onChange={(phrases) => onChange({ ...game, phrases })}
        />
      )}
      {PARAM_FIELDS[game.template].map((field) => (
        <NumberField key={field.key} field={field} game={game} onChange={onChange} />
      ))}
    </div>
  );
}
