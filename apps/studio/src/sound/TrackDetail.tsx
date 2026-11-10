import { BEAT_THIS_TRACKER, publishability, TempoMap } from '@ie/audio';
import type { Track } from '@ie/story';
import { Pause, Play, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  analyzeTrack,
  bestTracker,
  director,
  engine,
  removeTrack,
  updateTrack,
  useAnalysis,
} from '../audio/studio-audio.ts';
import { useBeatThisModel } from '../audio/beat-this-model.ts';
import { DeleteButton } from '../data/DeleteButton.tsx';
import { useT } from '../store.ts';
import { BeatStrip } from './BeatStrip.tsx';
import { BeatDots, TrackSummary } from './TrackSummary.tsx';
import { TapCalibration } from './TapCalibration.tsx';
import { TrackPublish } from './TrackPublish.tsx';
import { useBeatClock } from './useBeatClock.ts';

/** Plays a stored or catalogue track with its beats shown and, optionally, clicked. */
function BeatCheck({ track }: { readonly track: Track }) {
  const t = useT();
  const analysis = track.analysis;
  const [playing, setPlaying] = useState(false);
  const [click, setClick] = useState(true);
  const map = useMemo(() => (analysis ? TempoMap.fromAnalysis(analysis) : null), [analysis]);
  const reading = useBeatClock(playing ? director.music.clock : null, map, click);

  // Leaving the track (or the view) stops its preview.
  useEffect(
    () => () => {
      if (director.music.trackId === track.id) director.music.stop(0.2);
    },
    [track.id],
  );

  if (!analysis) return null;
  const toggle = async () => {
    await engine.resume();
    if (playing) {
      director.music.stop(0.2);
      setPlaying(false);
    } else {
      setPlaying(true);
      await director.music.set({ track: track.id, fade: 0.05, loop: false }, track);
    }
  };

  return (
    <div className="beat-check">
      <BeatStrip
        analysis={analysis}
        time={reading?.time ?? null}
        label={t('sound.beatStrip', {
          beats: analysis.beats.length,
          bars: analysis.downbeats.length,
        })}
        onSeek={playing ? (s) => director.music.seek(s) : undefined}
      />
      <div className="beat-check__bar">
        <button
          type="button"
          className="ie-button"
          data-testid="beat-check-play"
          onClick={() => void toggle()}
        >
          {playing ? (
            <Pause size={16} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Play size={16} strokeWidth={1.5} aria-hidden="true" />
          )}
          {playing ? t('sound.stop') : t('sound.playBeats')}
        </button>
        <label className="check">
          <input type="checkbox" checked={click} onChange={(e) => setClick(e.target.checked)} />
          {t('sound.click')}
        </label>
        <BeatDots count={analysis.beatsPerBar} current={reading?.beat ?? null} />
      </div>
    </div>
  );
}

const PUBLISH_KEY = {
  ok: 'sound.publish.ok',
  credit: 'sound.publish.credit',
  caution: 'sound.publish.caution',
  private: 'sound.publish.private',
} as const;

/** Everything about one track: names, licence, analysis and the beat check or tap calibration. */
export function TrackDetail({ track, uses }: { readonly track: Track; readonly uses: number }) {
  const t = useT();
  const job = useAnalysis((s) => s.jobs[track.id]);
  const fallback = useAnalysis((s) => s.fallbacks[track.id]);
  // Subscribed so the button appears once the model finishes downloading.
  const modelReady = useBeatThisModel((s) => s.status === 'ready');
  const tracker = track.analysis?.tracker;
  const canImprove = modelReady && tracker !== undefined && tracker !== bestTracker();
  const remote = track.source.kind === 'spotify' || track.source.kind === 'youtube';
  const license = track.license;
  const set = (patch: Partial<Pick<Track, 'title' | 'artist'>>) =>
    updateTrack(track.id, (x) => ({ ...x, ...patch }), `track:${track.id}`);

  return (
    <div className="track-detail" data-testid="track-detail">
      <div className="card__grid">
        <label className="labelled">
          <span className="ie-label">{t('sound.title')}</span>
          <input
            className="field"
            value={track.title}
            onChange={(e) => set({ title: e.target.value })}
          />
        </label>
        <label className="labelled">
          <span className="ie-label">{t('sound.artist')}</span>
          <input
            className="field"
            value={track.artist ?? ''}
            onChange={(e) => set({ artist: e.target.value })}
          />
        </label>
      </div>
      {license && (
        <p className="hint" data-testid="track-license">
          {t(PUBLISH_KEY[publishability(license.code)])}
          {license.attribution ? ` · ${license.attribution}` : ''}
        </p>
      )}
      <TrackPublish track={track} />
      <TrackSummary track={track} job={job} />
      {tracker && !job && (
        <p className="hint" data-testid="track-tracker">
          {fallback
            ? t('sound.fallback')
            : tracker === BEAT_THIS_TRACKER
              ? t('sound.trackerBeatThis')
              : t('sound.trackerDsp')}
        </p>
      )}
      {remote ? <TapCalibration track={track} /> : <BeatCheck track={track} />}
      <div className="card__foot">
        {!remote && (!track.analysis || canImprove) ? (
          <button
            type="button"
            className="ie-button ie-button--quiet"
            disabled={job !== undefined && 'stage' in job}
            onClick={() => void analyzeTrack(track.id)}
          >
            <RefreshCw size={16} strokeWidth={1.5} aria-hidden="true" />
            {track.analysis ? t('sound.analyzeBetter') : t('sound.analyze')}
          </button>
        ) : (
          <span />
        )}
        <DeleteButton uses={uses} onDelete={() => removeTrack(track)} />
      </div>
    </div>
  );
}
