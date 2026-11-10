import { findMaterial, type MaterialDef, type MaterialDomain } from '@ie/story';
import { useStudio, useT } from '../../store.ts';
import { useWrite } from '../context.ts';
import { labelText } from '../edit.ts';
import { Sentence } from '../Sentence.tsx';

/*
 * Sentences for the material stage actions (ADR 0020): a title's text material, the post
 * material, and setting or ramping a material parameter. The timeline uses them for clips too.
 */

type Params = Readonly<Record<string, unknown>>;
type Set = (patch: Params) => void;

const str = (value: unknown) => (typeof value === 'string' ? value : '');
const num = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

function MaterialPick({
  domain,
  value,
  none,
  label,
  testId,
  onChange,
}: {
  readonly domain?: MaterialDomain;
  readonly value: string;
  /** The label of the empty choice. */
  readonly none: string;
  readonly label: string;
  readonly testId: string;
  readonly onChange: (material: MaterialDef | undefined) => void;
}) {
  const { doc } = useWrite();
  const locale = useStudio((s) => s.locale);
  const list = (doc.materials ?? []).filter((m) => !domain || m.domain === domain);
  return (
    <select
      className="picker"
      aria-label={label}
      value={value}
      data-testid={testId}
      onChange={(e) => onChange(list.find((m) => m.id === e.target.value))}
    >
      <option value="">{none}</option>
      {list.map((m) => (
        <option key={m.id} value={m.id}>
          {labelText(m.name, locale, m.id)}
        </option>
      ))}
    </select>
  );
}

function NumberField({
  value,
  min,
  max,
  label,
  testId,
  onChange,
}: {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly label: string;
  readonly testId?: string;
  readonly onChange: (n: number) => void;
}) {
  const step = max - min > 10 ? 1 : 0.05;
  return (
    <input
      className="field field--number"
      type="number"
      min={min}
      max={max}
      step={step}
      aria-label={label}
      value={value}
      {...(testId ? { 'data-testid': testId } : {})}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
      }}
    />
  );
}

/** A title can name a text material that colours and moves its letters. */
export function TitleMaterial({ params, set }: { readonly params: Params; readonly set: Set }) {
  const t = useT();
  return (
    <label className="inline-field">
      <span>{t('mat.titleMaterial')}</span>
      <MaterialPick
        domain="text"
        value={str(params.material)}
        none={t('mat.none')}
        label={t('mat.titleMaterial')}
        testId="stage-title-material"
        onChange={(m) => set({ material: m?.id ?? '' })}
      />
    </label>
  );
}

export function PostSentence({ params, set }: { readonly params: Params; readonly set: Set }) {
  const t = useT();
  return (
    <Sentence
      template={t('stageBlock.post')}
      slots={{
        material: (
          <MaterialPick
            domain="post"
            value={str(params.material)}
            none={t('mat.noPost')}
            label={t('mat.material')}
            testId="stage-post-material"
            onChange={(m) => set({ material: m?.id ?? '' })}
          />
        ),
      }}
    />
  );
}

/**
 * "Set Strength of Glow to 0.2", and optionally "then to 1 over 2 s". On the timeline the clip's
 * length sets the seconds, so only the target value shows.
 */
export function ParamSentence({
  params,
  set,
  timed,
}: {
  readonly params: Params;
  readonly set: Set;
  readonly timed: boolean;
}) {
  const t = useT();
  const { doc } = useWrite();
  const locale = useStudio((s) => s.locale);
  const material = findMaterial(doc.materials, str(params.material));
  const param = material?.params.find((p) => p.id === params.param);
  const range = param ?? { min: 0, max: 1, default: 0 };
  const ramps = typeof params.to === 'number';
  return (
    <div className="stage-block__param">
      <Sentence
        template={t('stageBlock.param')}
        slots={{
          material: (
            <MaterialPick
              value={str(params.material)}
              none={t('mat.pick')}
              label={t('mat.material')}
              testId="stage-param-material"
              onChange={(m) => {
                const first = m?.params[0];
                set({
                  material: m?.id ?? '',
                  param: first?.id ?? '',
                  value: first?.default ?? 0,
                  ...(ramps && first ? { to: first.max } : {}),
                });
              }}
            />
          ),
          param: (
            <select
              className="picker"
              aria-label={t('mat.param')}
              value={str(params.param)}
              data-testid="stage-param-param"
              onChange={(e) => {
                const next = material?.params.find((p) => p.id === e.target.value);
                if (next) set({ param: next.id, value: next.default });
              }}
            >
              {!param && <option value="">{t('mat.pick')}</option>}
              {(material?.params ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {labelText(p.name, locale, p.id)}
                </option>
              ))}
            </select>
          ),
          value: (
            <NumberField
              value={num(params.value, range.default)}
              min={range.min}
              max={range.max}
              label={t('mat.value')}
              testId="stage-param-value"
              onChange={(value) => set({ value })}
            />
          ),
        }}
      />
      <label className="inline-field">
        <input
          type="checkbox"
          checked={ramps}
          data-testid="stage-param-ramp"
          onChange={(e) =>
            set(
              e.target.checked
                ? { to: range.max, ...(timed ? { seconds: 1 } : {}) }
                : { to: undefined, seconds: undefined },
            )
          }
        />
        <span>{t('mat.ramp')}</span>
      </label>
      {ramps && (
        <Sentence
          template={t(timed ? 'stageBlock.paramRamp' : 'seq.paramRamp')}
          slots={{
            to: (
              <NumberField
                value={num(params.to, range.max)}
                min={range.min}
                max={range.max}
                label={t('mat.to')}
                onChange={(to) => set({ to })}
              />
            ),
            seconds: (
              <NumberField
                value={num(params.seconds, 1)}
                min={0}
                max={30}
                label={t('stageBlock.seconds')}
                onChange={(seconds) => set({ seconds })}
              />
            ),
          }}
        />
      )}
    </div>
  );
}
