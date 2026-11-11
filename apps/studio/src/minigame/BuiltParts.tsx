import { BUILT_LIMITS, DICE_SIDES, type BuiltGame } from '@ie/story';
import { Plus, X } from 'lucide-react';
import { LabelFields } from '../data/LabelFields.tsx';
import { useT } from '../store.ts';
import {
  addButton,
  addMeter,
  removeButton,
  removeMeter,
  setButton,
  setMeter,
} from './built-edit.ts';

/** A whole number field that ignores what isn't one and keeps inside its limits. */
export function WholeField({
  value,
  min,
  max,
  label,
  onChange,
  testId,
}: {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly label: string;
  readonly onChange: (value: number) => void;
  readonly testId?: string;
}) {
  return (
    <input
      className="field field--number"
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={1}
      value={value}
      aria-label={label}
      data-testid={testId}
      onChange={(e) => {
        const n = Math.round(Number(e.target.value));
        if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
      }}
    />
  );
}

/** Meters, buttons, dice and the clock of a built minigame (ADR 0025). */
export function BuiltParts({
  game,
  onChange,
}: {
  readonly game: BuiltGame;
  readonly onChange: (game: BuiltGame) => void;
}) {
  const t = useT();
  const L = BUILT_LIMITS;
  const removeLabel = (name: string) => `${t('bg.remove')}: ${name}`;

  return (
    <div className="bg-parts" data-testid="bg-parts">
      <h4 className="bg__heading">{t('bg.meters')}</h4>
      <p className="hint">{t('bg.meterHint')}</p>
      {game.meters.map((m, i) => (
        <div className="bg-part" key={m.id} data-testid="bg-meter">
          <LabelFields
            value={m.label}
            prefix={t('bg.meter')}
            testId={`bg-meter-${i}`}
            onChange={(label) => onChange(setMeter(game, m.id, { label }))}
          />
          <label className="inline-field">
            <span>{t('bg.start')}</span>
            <WholeField
              value={m.start ?? 0}
              min={0}
              max={m.max}
              label={t('bg.start')}
              onChange={(start) => onChange(setMeter(game, m.id, { start }))}
            />
          </label>
          <label className="inline-field">
            <span>{t('bg.max')}</span>
            <WholeField
              value={m.max}
              min={L.max[0]}
              max={L.max[1]}
              label={t('bg.max')}
              testId={`bg-meter-max-${i}`}
              onChange={(max) => onChange(setMeter(game, m.id, { max }))}
            />
          </label>
          <button
            type="button"
            className="ie-button ie-button--quiet icon-button"
            aria-label={removeLabel(m.label.en || m.id)}
            disabled={game.meters.length <= L.meters[0]}
            onClick={() => onChange(removeMeter(game, m.id))}
          >
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      ))}
      {game.meters.length < L.meters[1] && (
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-testid="bg-add-meter"
          onClick={() => {
            const n = game.meters.length + 1;
            onChange(addMeter(game, { en: `Meter ${n}`, tr: `Gösterge ${n}` }));
          }}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('bg.addMeter')}
        </button>
      )}

      <h4 className="bg__heading">{t('bg.buttons')}</h4>
      {game.buttons.map((b, i) => (
        <div className="bg-part" key={b.id} data-testid="bg-button">
          <LabelFields
            value={b.label}
            prefix={t('bg.button')}
            testId={`bg-button-${i}`}
            onChange={(label) => onChange(setButton(game, b.id, label))}
          />
          <button
            type="button"
            className="ie-button ie-button--quiet icon-button"
            aria-label={removeLabel(b.label.en || b.id)}
            onClick={() => onChange(removeButton(game, b.id))}
          >
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      ))}
      {game.buttons.length < L.buttons[1] && (
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-testid="bg-add-button"
          onClick={() => {
            const n = game.buttons.length + 1;
            onChange(addButton(game, { en: `Button ${n}`, tr: `Düğme ${n}` }));
          }}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('bg.addButton')}
        </button>
      )}

      <div className="row row--wrap bg-part">
        <label className="check">
          <input
            type="checkbox"
            checked={game.dice !== undefined}
            data-testid="bg-dice"
            onChange={(e) => {
              const { dice: _old, ...rest } = game;
              onChange(e.target.checked ? { ...rest, dice: { count: 2, sides: 6 } } : rest);
            }}
          />
          {t('bg.dice')}
        </label>
        {game.dice && (
          <>
            <label className="inline-field">
              <span>{t('bg.diceCount')}</span>
              <WholeField
                value={game.dice.count}
                min={L.dice[0]}
                max={L.dice[1]}
                label={t('bg.diceCount')}
                onChange={(count) =>
                  game.dice && onChange({ ...game, dice: { ...game.dice, count } })
                }
              />
            </label>
            <label className="inline-field">
              <span>{t('bg.sides')}</span>
              <select
                className="picker"
                value={game.dice.sides}
                onChange={(e) =>
                  game.dice &&
                  onChange({ ...game, dice: { ...game.dice, sides: Number(e.target.value) } })
                }
              >
                {DICE_SIDES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>

      <div className="row row--wrap bg-part">
        <label className="check">
          <input
            type="checkbox"
            checked={game.seconds !== undefined}
            data-testid="bg-clock"
            onChange={(e) => {
              const { seconds: _old, timeout: _t, ...rest } = game;
              onChange(e.target.checked ? { ...rest, seconds: 30, timeout: 'lose' } : rest);
            }}
          />
          {t('bg.clock')}
        </label>
        {game.seconds !== undefined && (
          <>
            <label className="inline-field">
              <span>{t('bg.seconds')}</span>
              <WholeField
                value={game.seconds}
                min={L.seconds[0]}
                max={L.seconds[1]}
                label={t('bg.seconds')}
                testId="bg-seconds"
                onChange={(seconds) => onChange({ ...game, seconds })}
              />
            </label>
            <label className="inline-field">
              <span>{t('bg.timeout')}</span>
              <select
                className="picker"
                value={game.timeout ?? 'lose'}
                onChange={(e) => onChange({ ...game, timeout: e.target.value as 'win' | 'lose' })}
              >
                <option value="lose">{t('bg.timeout.lose')}</option>
                <option value="win">{t('bg.timeout.win')}</option>
              </select>
            </label>
          </>
        )}
      </div>
    </div>
  );
}
