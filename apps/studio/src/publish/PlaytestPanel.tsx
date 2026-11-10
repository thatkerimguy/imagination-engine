import {
  PlaytestTally,
  type CompiledStory,
  type PlaytestReport,
  type PlaytestSpot,
} from '@ie/story';
import { Bot } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { runAction } from '../kernel.ts';
import { useProject } from '../project/store.ts';
import { useStudio, useT } from '../store.ts';
import { labelText } from '../write/edit.ts';

const RUN_COUNTS = [100, 500, 2000] as const;
/** Runs per slice; small enough that a slice stays well under a frame on the phone. */
const SLICE = 20;

/** Jumps to a passage (and block) in Write. */
function SpotButton({ spot, label }: { readonly spot: PlaytestSpot; readonly label: string }) {
  const openPassage = useProject((s) => s.openPassage);
  return (
    <button
      type="button"
      className="problems__item"
      disabled={!spot.passage}
      onClick={() => {
        if (!spot.passage) return;
        openPassage(spot.passage, spot.blockId ?? undefined);
        runAction('studio.view.open', { view: 'write' });
      }}
    >
      <span className="problems__text">{label}</span>
    </button>
  );
}

/** The auto-playtester (PLAN §8.3): many random runs, then what they found. */
export function PlaytestPanel({
  story,
  report,
  onReport,
}: {
  readonly story: CompiledStory;
  readonly report: PlaytestReport | null;
  readonly onReport: (report: PlaytestReport | null) => void;
}) {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const [runs, setRuns] = useState<number>(500);
  const [done, setDone] = useState<number | null>(null);
  const cancel = useRef<(() => void) | null>(null);
  useEffect(() => () => cancel.current?.(), []);

  const passageName = (id: string | null) => {
    if (!id) return '—';
    return story.passages.get(id)?.passage.name ?? id;
  };
  const endingName = (id: string) => {
    if (!id) return t('pt.endingUnnamed');
    for (const info of story.blocks.values())
      if (info.block.type === 'end' && info.block.ending?.id === id)
        return labelText(info.block.ending.title, locale, id);
    return id;
  };

  const start = () => {
    cancel.current?.();
    const tally = new PlaytestTally(story);
    let seed = 1;
    let stopped = false;
    cancel.current = () => {
      stopped = true;
    };
    setDone(0);
    onReport(null);
    const slice = () => {
      if (stopped) return;
      const end = Math.min(runs, seed + SLICE - 1);
      for (; seed <= end; seed++) tally.play(seed);
      setDone(seed - 1);
      if (seed > runs) {
        setDone(null);
        onReport(tally.report());
      } else setTimeout(slice, 0);
    };
    setTimeout(slice, 0);
  };

  const spots = (title: string, list: readonly PlaytestSpot[], testId: string) =>
    list.length > 0 && (
      <div data-testid={testId}>
        <h4>{title}</h4>
        <ul className="problems">
          {list.map((spot, i) => (
            <li key={i}>
              <SpotButton
                spot={spot}
                label={t('pt.spot', { passage: passageName(spot.passage), n: spot.count })}
              />
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <div className="lib-section" data-testid="playtest">
      <h3>{t('pt.title')}</h3>
      <p className="hint">{t('pt.intro')}</p>
      <div className="row row--wrap">
        <label className="inline-field">
          <span>{t('pt.runs')}</span>
          <select
            className="picker"
            value={runs}
            data-testid="pt-runs"
            onChange={(e) => setRuns(Number(e.target.value))}
          >
            {RUN_COUNTS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="ie-button ie-button--primary"
          data-testid="pt-start"
          disabled={done !== null}
          onClick={start}
        >
          <Bot size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('pt.start')}
        </button>
        {done !== null && (
          <span className="hint" role="status" data-testid="pt-progress">
            {t('pt.progress', { done, runs })}
          </span>
        )}
      </div>

      {report && (
        <div className="pt-report" data-testid="pt-report">
          <p data-testid="pt-summary">
            {t('pt.summary', { runs: report.runs, steps: report.averageSteps })}
          </p>
          <h4>{t('pt.endings')}</h4>
          {Object.keys(report.endings).length === 0 ? (
            <p className="hint">{t('pt.noEndings')}</p>
          ) : (
            <ul className="pt-list" data-testid="pt-endings">
              {Object.entries(report.endings)
                .sort((a, b) => b[1] - a[1])
                .map(([id, count]) => (
                  <li key={id}>
                    <span>{endingName(id)}</span>
                    <span className="pt-count">
                      {Math.round((count / report.runs) * 100)}% · {count}
                    </span>
                  </li>
                ))}
            </ul>
          )}
          {spots(t('pt.softlocks'), report.softlocks, 'pt-softlocks')}
          {spots(t('pt.deadEnds'), report.deadEnds, 'pt-dead-ends')}
          {spots(t('pt.stuck'), report.stuck, 'pt-stuck')}
          {report.errors.length > 0 && (
            <div data-testid="pt-errors">
              <h4>{t('pt.errors')}</h4>
              <ul className="problems">
                {report.errors.map((e, i) => (
                  <li key={i}>
                    <SpotButton spot={e} label={`${passageName(e.passage)}: ${e.message}`} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <h4>{t('pt.unseen')}</h4>
          <p className="hint" data-testid="pt-unseen">
            {report.unseenPassages.length
              ? report.unseenPassages.map((id) => passageName(id)).join(', ')
              : t('pt.allSeen')}
          </p>
          <p className="hint">
            {t('pt.unchosen', { n: report.unchosenOptions.length, total: story.options.size })}
          </p>
          {Object.keys(report.ranges).length > 0 && (
            <>
              <h4>{t('pt.ranges')}</h4>
              <ul className="pt-list">
                {Object.entries(report.ranges).map(([id, r]) => (
                  <li key={id}>
                    <span>{labelText(story.variables.get(id)?.name, locale, id)}</span>
                    <span className="pt-count">
                      {r.min} – {r.max}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
