import {
  BUILT_ACTIONS,
  BUILT_EVENTS,
  BUILT_LIMITS,
  BUILT_OPS,
  BUILT_ROLL,
  BUILT_TIME,
  type BuiltAction,
  type BuiltEvent,
  type BuiltGame,
  type BuiltRule,
} from '@ie/story';
import { Plus, X } from 'lucide-react';
import type { MessageKey } from '../messages.ts';
import { useStudio, useT } from '../store.ts';
import { labelText } from '../write/edit.ts';
import { actionOfKind, addRule, removeRule, setRule } from './built-edit.ts';
import { WholeField } from './BuiltParts.tsx';

const L = BUILT_LIMITS;

/** The rules of a built minigame, each a sentence: when …, and …, then … (ADR 0025). */
export function BuiltRules({
  game,
  onChange,
}: {
  readonly game: BuiltGame;
  readonly onChange: (game: BuiltGame) => void;
}) {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const meterName = (id: string) =>
    labelText(game.meters.find((m) => m.id === id)?.label, locale, id);
  const edit = (rule: BuiltRule, change: (r: BuiltRule) => BuiltRule) =>
    onChange(setRule(game, rule.id, change));

  const meterPicker = (value: string | undefined, onPick: (id: string) => void, extra = false) => (
    <select
      className="picker"
      aria-label={t('bg.meter')}
      value={value ?? ''}
      onChange={(e) => onPick(e.target.value)}
    >
      {game.meters.map((m) => (
        <option key={m.id} value={m.id}>
          {meterName(m.id)}
        </option>
      ))}
      {extra && game.dice && <option value={BUILT_ROLL}>{t('bg.of.roll')}</option>}
      {extra && <option value={BUILT_TIME}>{t('bg.of.time')}</option>}
    </select>
  );

  const action = (rule: BuiltRule, a: BuiltAction, index: number) => {
    const setAction = (next: BuiltAction) =>
      edit(rule, (r) => ({ ...r, then: r.then.map((x, i) => (i === index ? next : x)) }));
    return (
      <div className="row row--wrap bg-clause" key={index} data-testid="bg-action">
        <span className="bg-word">{index === 0 ? t('bg.then') : t('bg.if')}</span>
        <select
          className="picker"
          aria-label={t('bg.then')}
          value={a.do}
          data-testid="bg-do"
          onChange={(e) => setAction(actionOfKind(a, e.target.value as BuiltAction['do'], game))}
        >
          {BUILT_ACTIONS.filter((k) => k !== 'addRoll' || game.dice).map((k) => (
            <option key={k} value={k}>
              {t(`bg.do.${k}` as MessageKey)}
            </option>
          ))}
        </select>
        {a.do !== 'win' && a.do !== 'lose' && (
          <>
            {meterPicker(a.meter, (meter) => setAction({ ...a, meter }))}
            {a.do !== 'addRoll' && (
              <WholeField
                value={a.value ?? 0}
                min={L.value[0]}
                max={L.value[1]}
                label={t('bg.value')}
                onChange={(value) => setAction({ ...a, value })}
              />
            )}
          </>
        )}
        {rule.then.length > L.actions[0] && (
          <button
            type="button"
            className="ie-button ie-button--quiet icon-button"
            aria-label={t('bg.remove')}
            onClick={() =>
              edit(rule, (r) => ({ ...r, then: r.then.filter((_, i) => i !== index) }))
            }
          >
            <X size={14} strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="bg-rules" data-testid="bg-rules">
      <h4 className="bg__heading">{t('bg.rules')}</h4>
      <p className="hint">{t('bg.rulesHint')}</p>
      {game.rules.map((rule, n) => (
        <fieldset className="bg-rule" key={rule.id} data-testid="bg-rule">
          <legend className="ie-label">{t('bg.rule', { n: n + 1 })}</legend>
          <div className="row row--wrap bg-clause">
            <span className="bg-word">{t('bg.when')}</span>
            <select
              className="picker"
              aria-label={t('bg.when')}
              value={rule.on}
              data-testid="bg-on"
              onChange={(e) => {
                const on = e.target.value as BuiltEvent;
                edit(rule, ({ button: _b, ...r }) =>
                  on === 'tap' && game.buttons[0]
                    ? { ...r, on, button: game.buttons[0].id }
                    : { ...r, on },
                );
              }}
            >
              {BUILT_EVENTS.filter(
                (e) =>
                  (e !== 'tap' || game.buttons.length) &&
                  (e !== 'roll' || game.dice) &&
                  (e !== 'timeout' || game.seconds),
              ).map((e) => (
                <option key={e} value={e}>
                  {t(`bg.on.${e}` as MessageKey)}
                </option>
              ))}
            </select>
            {rule.on === 'tap' && (
              <select
                className="picker"
                aria-label={t('bg.button')}
                value={rule.button ?? ''}
                onChange={(e) => edit(rule, (r) => ({ ...r, button: e.target.value }))}
              >
                {game.buttons.map((b) => (
                  <option key={b.id} value={b.id}>
                    {labelText(b.label, locale, b.id)}
                  </option>
                ))}
              </select>
            )}
          </div>
          {(rule.if ?? []).map((c, i) => (
            <div className="row row--wrap bg-clause" key={i} data-testid="bg-condition">
              <span className="bg-word">{t('bg.if')}</span>
              {meterPicker(
                c.of,
                (of) =>
                  edit(rule, (r) => ({
                    ...r,
                    if: (r.if ?? []).map((x, j) => (j === i ? { ...x, of } : x)),
                  })),
                true,
              )}
              <select
                className="picker"
                aria-label={t('bg.value')}
                value={c.op}
                onChange={(e) =>
                  edit(rule, (r) => ({
                    ...r,
                    if: (r.if ?? []).map((x, j) =>
                      j === i ? { ...x, op: e.target.value as typeof c.op } : x,
                    ),
                  }))
                }
              >
                {BUILT_OPS.map((op) => (
                  <option key={op} value={op}>
                    {op === '<=' ? '≤' : op === '>=' ? '≥' : op}
                  </option>
                ))}
              </select>
              <WholeField
                value={c.value}
                min={L.value[0]}
                max={L.value[1]}
                label={t('bg.value')}
                onChange={(value) =>
                  edit(rule, (r) => ({
                    ...r,
                    if: (r.if ?? []).map((x, j) => (j === i ? { ...x, value } : x)),
                  }))
                }
              />
              <button
                type="button"
                className="ie-button ie-button--quiet icon-button"
                aria-label={t('bg.remove')}
                onClick={() =>
                  edit(rule, ({ if: list, ...r }) => {
                    const rest = (list ?? []).filter((_, j) => j !== i);
                    return rest.length ? { ...r, if: rest } : r;
                  })
                }
              >
                <X size={14} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
          ))}
          {rule.then.map((a, i) => action(rule, a, i))}
          <div className="row row--wrap">
            {(rule.if?.length ?? 0) < L.conditions[1] && (
              <button
                type="button"
                className="ie-button ie-button--quiet"
                data-testid="bg-add-if"
                onClick={() =>
                  edit(rule, (r) => ({
                    ...r,
                    if: [
                      ...(r.if ?? []),
                      { of: game.meters[0]?.id ?? BUILT_TIME, op: '>=', value: 1 },
                    ],
                  }))
                }
              >
                <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
                {t('bg.addIf')}
              </button>
            )}
            {rule.then.length < L.actions[1] && (
              <button
                type="button"
                className="ie-button ie-button--quiet"
                onClick={() => edit(rule, (r) => ({ ...r, then: [...r.then, { do: 'win' }] }))}
              >
                <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
                {t('bg.addDo')}
              </button>
            )}
            {game.rules.length > L.rules[0] && (
              <button
                type="button"
                className="ie-button ie-button--quiet"
                onClick={() => onChange(removeRule(game, rule.id))}
              >
                <X size={14} strokeWidth={1.5} aria-hidden="true" />
                {t('bg.remove')}
              </button>
            )}
          </div>
        </fieldset>
      ))}
      {game.rules.length < L.rules[1] && (
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-testid="bg-add-rule"
          onClick={() => onChange(addRule(game))}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('bg.addRule')}
        </button>
      )}
      <label className="inline-field">
        <span>{t('bg.score')}</span>
        <select
          className="picker"
          value={game.scoreMeter ?? ''}
          onChange={(e) => {
            const { scoreMeter: _old, ...rest } = game;
            onChange(e.target.value ? { ...rest, scoreMeter: e.target.value } : rest);
          }}
        >
          <option value="">{t('bg.scoreWon')}</option>
          {game.meters.map((m) => (
            <option key={m.id} value={m.id}>
              {meterName(m.id)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
