import {
  STAGE_BACKGROUNDS,
  STAGE_BURSTS,
  STAGE_COLORS,
  STAGE_LOOKS,
  STAGE_TRANSITIONS,
  type ActionBlock,
} from '@ie/story';
import type { ReactNode } from 'react';
import type { MessageKey } from '../../messages.ts';
import { stageKind, type STAGE_KINDS } from '../../project/stage-kinds.ts';
import { useT } from '../../store.ts';
import { useWrite } from '../context.ts';
import { Sentence } from '../Sentence.tsx';

type Params = Readonly<Record<string, unknown>>;

const num = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const str = (value: unknown, fallback: string) => (typeof value === 'string' ? value : fallback);

/** A select over fixed choices whose labels come from `prefix.choice` message keys. */
function Choice({
  choices,
  value,
  prefix,
  label,
  onChange,
}: {
  readonly choices: readonly string[];
  readonly value: string;
  readonly prefix: string;
  readonly label: string;
  readonly onChange: (value: string) => void;
}) {
  const t = useT();
  return (
    <select
      className="picker"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {choices.map((c) => (
        <option key={c} value={c}>
          {t(`${prefix}.${c}` as MessageKey)}
        </option>
      ))}
    </select>
  );
}

function Amount({
  value,
  label,
  onChange,
}: {
  readonly value: number;
  readonly label: string;
  readonly onChange: (n: number) => void;
}) {
  return (
    <select
      className="picker"
      aria-label={label}
      value={String(Math.round(value * 10) / 10)}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {[0.2, 0.4, 0.6, 0.8, 1].map((v) => (
        <option key={v} value={String(v)}>
          {`${Math.round(v * 100)}%`}
        </option>
      ))}
    </select>
  );
}

function Seconds({
  value,
  min,
  max,
  step,
  label,
  onChange,
}: {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly label: string;
  readonly onChange: (n: number) => void;
}) {
  return (
    <input
      className="field field--number"
      type="number"
      min={min}
      max={max}
      step={step}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
    />
  );
}

const STRENGTHS = [
  ['light', 0.3],
  ['medium', 0.6],
  ['heavy', 1],
] as const;

/** Background, look, screen effect, particles, title and transition blocks as sentences. */
export function StageEditor({ block }: { readonly block: ActionBlock }) {
  const t = useT();
  const { doc, editor } = useWrite();
  const kind = stageKind(block);
  const params: Params = block.params ?? {};
  const update = (next: Partial<ActionBlock>) =>
    editor.block(block.id, (b) => ({ ...(b as ActionBlock), ...next }), `stage:${block.id}`);
  const set = (patch: Params) => update({ params: { ...params, ...patch } });
  const color = (fallback: string) => (
    <Choice
      choices={STAGE_COLORS}
      value={str(params.color, fallback)}
      prefix="stage.color"
      label={t('stageBlock.color')}
      onChange={(c) => set({ color: c })}
    />
  );

  let body: ReactNode = null;
  switch (kind) {
    case 'background':
      body = (
        <Sentence
          template={t('stageBlock.background')}
          slots={{
            preset: (
              <Choice
                choices={STAGE_BACKGROUNDS}
                value={str(params.preset, 'rain')}
                prefix="stage.background"
                label={t('stageBlock.preset')}
                onChange={(preset) => set({ preset })}
              />
            ),
            amount: (
              <Amount
                value={num(params.amount, 0.6)}
                label={t('stageBlock.amount')}
                onChange={(amount) => set({ amount })}
              />
            ),
          }}
        />
      );
      break;
    case 'look':
      body = (
        <Sentence
          template={t('stageBlock.look')}
          slots={{
            look: (
              <Choice
                choices={STAGE_LOOKS}
                value={str(params.look, 'film')}
                prefix="stage.look"
                label={t('stageBlock.lookLabel')}
                onChange={(look) => set({ look })}
              />
            ),
          }}
        />
      );
      break;
    case 'effect':
      body = (
        <EffectSentence block={block} params={params} set={set} update={update} color={color} />
      );
      break;
    case 'burst':
      body = (
        <Sentence
          template={t('stageBlock.burst')}
          slots={{
            preset: (
              <Choice
                choices={STAGE_BURSTS}
                value={str(params.preset, 'burst')}
                prefix="stage.burst"
                label={t('stageBlock.burstLabel')}
                onChange={(preset) => set({ preset })}
              />
            ),
            color: color('accent'),
          }}
        />
      );
      break;
    case 'title': {
      const text = (params.text ?? {}) as Readonly<Record<string, string>>;
      body = (
        <div className="stage-block__title">
          {doc.languages.map((language) => (
            <label key={language} className="labelled">
              <span>{t('stageBlock.titleText', { language: t(`language.${language}`) })}</span>
              <input
                className="field"
                lang={language}
                value={text[language] ?? ''}
                data-testid={`stage-title-${language}`}
                onChange={(e) => set({ text: { ...text, [language]: e.target.value } })}
              />
            </label>
          ))}
          <Sentence
            template={t('stageBlock.titleTiming')}
            slots={{
              seconds: (
                <Seconds
                  value={num(params.seconds, 3)}
                  min={0.5}
                  max={20}
                  step={0.5}
                  label={t('stageBlock.seconds')}
                  onChange={(seconds) => set({ seconds })}
                />
              ),
              exit: (
                <Choice
                  choices={['fade', 'shatter']}
                  value={str(params.exit, 'fade')}
                  prefix="stage.exit"
                  label={t('stageBlock.exit')}
                  onChange={(exit) => set({ exit })}
                />
              ),
            }}
          />
        </div>
      );
      break;
    }
    case 'transition':
      body = (
        <Sentence
          template={t('stageBlock.transition')}
          slots={{
            kind: (
              <Choice
                choices={STAGE_TRANSITIONS}
                value={str(params.kind, 'dissolve')}
                prefix="stage.transition"
                label={t('stageBlock.kind')}
                onChange={(k) => set({ kind: k })}
              />
            ),
            seconds: (
              <Seconds
                value={num(params.seconds, 1.2)}
                min={0.2}
                max={4}
                step={0.2}
                label={t('stageBlock.seconds')}
                onChange={(seconds) => set({ seconds })}
              />
            ),
          }}
        />
      );
      break;
  }
  return <div className="stage-block">{body}</div>;
}

type EffectAction = (typeof STAGE_KINDS.effect)[number];
const EFFECT_NAMES: Record<EffectAction, string> = {
  'stage.shake': 'shake',
  'stage.flash': 'flash',
  'stage.hitstop': 'hitstop',
};

/** Shake, flash and freeze share one block; switching the effect swaps its action and settings. */
function EffectSentence({
  block,
  params,
  set,
  update,
  color,
}: {
  readonly block: ActionBlock;
  readonly params: Params;
  readonly set: (patch: Params) => void;
  readonly update: (next: Partial<ActionBlock>) => void;
  readonly color: (fallback: string) => ReactNode;
}) {
  const t = useT();
  const action = (block.action in EFFECT_NAMES ? block.action : 'stage.shake') as EffectAction;
  const name = EFFECT_NAMES[action];
  const effect = (
    <select
      className="picker"
      aria-label={t('stageBlock.effectLabel')}
      value={name}
      data-testid="stage-effect"
      onChange={(e) => {
        const next = e.target.value;
        if (next === 'flash') update({ action: 'stage.flash', params: { color: 'white' } });
        else if (next === 'hitstop') update({ action: 'stage.hitstop', params: { seconds: 0.1 } });
        else update({ action: 'stage.shake', params: { strength: 0.6 } });
      }}
    >
      {Object.values(EFFECT_NAMES).map((n) => (
        <option key={n} value={n}>
          {t(`stage.effect.${n}` as MessageKey)}
        </option>
      ))}
    </select>
  );
  if (name === 'flash')
    return <Sentence template={t('stageBlock.flash')} slots={{ effect, color: color('white') }} />;
  if (name === 'hitstop')
    return (
      <Sentence
        template={t('stageBlock.hitstop')}
        slots={{
          effect,
          seconds: (
            <Seconds
              value={num(params.seconds, 0.1)}
              min={0.02}
              max={1}
              step={0.02}
              label={t('stageBlock.seconds')}
              onChange={(seconds) => set({ seconds })}
            />
          ),
        }}
      />
    );
  const strength = num(params.strength, 0.6);
  const nearest = STRENGTHS.reduce((a, b) =>
    Math.abs(b[1] - strength) < Math.abs(a[1] - strength) ? b : a,
  );
  return (
    <Sentence
      template={t('stageBlock.shake')}
      slots={{
        effect,
        strength: (
          <select
            className="picker"
            aria-label={t('stageBlock.strength')}
            value={nearest[0]}
            onChange={(e) =>
              set({ strength: STRENGTHS.find((s) => s[0] === e.target.value)?.[1] ?? 0.6 })
            }
          >
            {STRENGTHS.map(([n]) => (
              <option key={n} value={n}>
                {t(`stage.strength.${n}` as MessageKey)}
              </option>
            ))}
          </select>
        ),
      }}
    />
  );
}
