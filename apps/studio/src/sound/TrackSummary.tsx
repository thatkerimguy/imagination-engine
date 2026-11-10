import type { Track } from '@ie/story';
import type { AnalysisJob } from '../audio/studio-audio.ts';
import { useT } from '../store.ts';
import { formatTime, keyParts } from './format.ts';

/** One dot per beat of the bar; the current one lights, the downbeat is drawn larger. */
export function BeatDots({
  count,
  current,
}: {
  readonly count: number;
  readonly current: number | null;
}) {
  return (
    <span className="beat-dots" aria-hidden="true" data-testid="beat-dots">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="beat-dots__dot" data-down={i === 0} data-on={current === i} />
      ))}
    </span>
  );
}

/** "120 BPM · 4/4 · A minor · 3:28", or where the analysis stands. */
export function TrackSummary({
  track,
  job,
}: {
  readonly track: Track;
  readonly job?: AnalysisJob;
}) {
  const t = useT();
  if (job && 'stage' in job)
    return (
      <p className="track-summary" data-testid="track-status" aria-live="polite">
        {job.fraction === undefined
          ? t('sound.analyzing', { stage: t(`sound.stage.${job.stage}`) })
          : t('sound.analyzingPercent', {
              stage: t(`sound.stage.${job.stage}`),
              percent: Math.round(job.fraction * 100),
            })}
      </p>
    );
  if (job && 'error' in job)
    return (
      <p className="track-summary" data-testid="track-status" data-error>
        {job.error === 'missing-file' ? t('sound.missingFile') : t('sound.analysisFailed')}
      </p>
    );
  const a = track.analysis;
  const c = track.calibration;
  if (!a && !c)
    return (
      <p className="track-summary" data-testid="track-status">
        {track.source.kind === 'spotify' || track.source.kind === 'youtube'
          ? t('sound.needsTaps')
          : t('sound.notAnalyzed')}
      </p>
    );
  const key = keyParts(a?.key);
  const parts = [
    t('sound.bpm', { bpm: Math.round((a?.bpm ?? c?.bpm ?? 0) * 10) / 10 }),
    `${a?.beatsPerBar ?? c?.beatsPerBar ?? 4}/4`,
    ...(key ? [t(`sound.key.${key.mode}`, { tonic: key.tonic })] : []),
    ...(a ? [formatTime(a.duration)] : []),
    ...(a?.tempo === 'variable' ? [t('sound.tempoVariable')] : []),
    ...(c && !a ? [t('sound.tapped')] : []),
  ];
  return (
    <p className="track-summary" data-testid="track-status">
      {parts.join(' · ')}
    </p>
  );
}
