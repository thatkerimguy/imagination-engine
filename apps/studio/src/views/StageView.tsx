import type { TierName } from '@ie/stage';
import { STAGE_BACKGROUNDS, STAGE_LOOKS, type StageBackground, type StageLook } from '@ie/story';
import { useEffect, useRef, useState } from 'react';
import { Segmented } from '../components/Segmented.tsx';
import { runAction } from '../kernel.ts';
import { messages, type MessageKey } from '../messages.ts';
import { BACKGROUND_ICON, LOOK_ICON } from '../project/preset-icons.ts';
import { attachStage, setStageLocale, stage } from '../stage/studio-stage.ts';
import { useStudio, useT } from '../store.ts';

type Tier = TierName | 'auto';

const SAMPLE_TITLE = {
  en: messages.en['stageView.titleSample'],
  tr: messages.tr['stageView.titleSample'],
};

/** Each moment is one stage action, run through the action bus exactly as a block would. */
const MOMENTS: readonly { key: MessageKey; action: string; params: unknown }[] = [
  { key: 'stage.effect.shake', action: 'stage.shake', params: { strength: 0.6 } },
  { key: 'stage.effect.flash', action: 'stage.flash', params: { color: 'white' } },
  { key: 'stage.effect.hitstop', action: 'stage.hitstop', params: { seconds: 0.12 } },
  { key: 'block.burst', action: 'stage.burst', params: { preset: 'burst', color: 'accent' } },
  { key: 'stageView.sparks', action: 'stage.burst', params: { preset: 'sparks', color: 'gold' } },
  {
    key: 'block.title',
    action: 'stage.title',
    params: { text: SAMPLE_TITLE, seconds: 2.5, exit: 'shatter' },
  },
  {
    key: 'stage.transition.ink',
    action: 'stage.transition',
    params: { kind: 'ink', seconds: 1.2 },
  },
];

/** A playground for the stage: scene settings, moments, the quality tier and live frame stats. */
export function StageView() {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const panel = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLParagraphElement>(null);
  const [background, setBackground] = useState('rain');
  const [look, setLook] = useState('none');
  const [tier, setTier] = useState<Tier>('auto');
  const [available, setAvailable] = useState(true);
  const [stats, setStats] = useState('');

  useEffect(() => {
    if (!panel.current) return;
    const detach = attachStage(panel.current, text.current, locale);
    setAvailable(stage.ensure() !== null);
    runAction('stage.background.set', { preset: 'rain', amount: 0.6 });
    const timer = setInterval(() => {
      const s = stage.stage?.stats();
      if (!s) return;
      setStats(
        t('stageView.stats', {
          tier: t(`stageView.tier.${s.tier}`),
          sprites: s.sprites,
          calls: s.drawCalls,
          ms: s.frameMs.toFixed(2),
        }),
      );
    }, 500);
    return () => {
      clearInterval(timer);
      stage.setTier(null);
      detach();
    };
    // The panel is attached once; locale changes go through setStageLocale below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setStageLocale(locale), [locale]);

  const pickBackground = (preset: string) => {
    setBackground(preset);
    runAction('stage.background.set', { preset, amount: 0.6 });
  };
  const pickLook = (next: string) => {
    setLook(next);
    runAction('stage.look.set', { look: next });
  };
  const pickTier = (next: Tier) => {
    setTier(next);
    stage.setTier(next === 'auto' ? null : next);
  };
  const clear = () => {
    stage.stage?.clearMoments();
    pickBackground('none');
    pickLook('none');
  };

  const BackgroundIcon = BACKGROUND_ICON[background as StageBackground] ?? BACKGROUND_ICON.none;
  const LookIcon = LOOK_ICON[look as StageLook] ?? LOOK_ICON.none;
  return (
    <section className="page page--wide" data-testid="view-stage">
      <h2 className="page__title">{t('view.stage')}</h2>
      <p className="page__intro">{t('stageView.intro')}</p>
      {!available && (
        <p className="stage-view__note" role="status">
          {t('stageView.unavailable')}
        </p>
      )}
      <div className="stage-view">
        <div className="stage-view__panel" ref={panel} data-testid="stage-panel">
          <p className="stage-view__text" ref={text}>
            {t('desc.stage')}
          </p>
        </div>
        <div className="stage-view__controls">
          <fieldset className="stage-view__group">
            <legend>{t('stageView.scene')}</legend>
            <label className="labelled">
              <span>{t('block.background')}</span>
              <span className="preset-choice">
                <BackgroundIcon size={16} strokeWidth={1.5} aria-hidden="true" />
                <select
                  className="picker"
                  value={background}
                  data-testid="stage-background"
                  onChange={(e) => pickBackground(e.target.value)}
                >
                  {STAGE_BACKGROUNDS.map((b) => (
                    <option key={b} value={b}>
                      {t(`stage.background.${b}`)}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className="labelled">
              <span>{t('block.look')}</span>
              <span className="preset-choice">
                <LookIcon size={16} strokeWidth={1.5} aria-hidden="true" />
                <select className="picker" value={look} onChange={(e) => pickLook(e.target.value)}>
                  {STAGE_LOOKS.map((l) => (
                    <option key={l} value={l}>
                      {t(`stage.look.${l}`)}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          </fieldset>
          <fieldset className="stage-view__group">
            <legend>{t('stageView.moments')}</legend>
            <div className="stage-view__moments">
              {MOMENTS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className="ie-button"
                  data-testid={`moment-${m.action}`}
                  onClick={() => runAction(m.action, m.params)}
                >
                  {t(m.key)}
                </button>
              ))}
              <button type="button" className="ie-button ie-button--quiet" onClick={clear}>
                {t('stageView.clear')}
              </button>
            </div>
          </fieldset>
          <fieldset className="stage-view__group">
            <legend>{t('stageView.tier')}</legend>
            <Segmented
              label={t('stageView.tier')}
              value={tier}
              options={(['auto', 'low', 'medium', 'high'] as const).map((v) => ({
                value: v,
                label: t(`stageView.tier.${v}`),
              }))}
              onChange={pickTier}
            />
            <p className="stage-view__stats" data-testid="stage-stats" aria-live="off">
              {stats}
            </p>
          </fieldset>
        </div>
      </div>
    </section>
  );
}
