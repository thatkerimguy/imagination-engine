import { SpotifySource, tapGrid, TempoMap, YouTubeSource, type ClockSource } from '@ie/audio';
import type { Track } from '@ie/story';
import { Hand, Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { updateTrack } from '../audio/studio-audio.ts';
import { spotifyToken, useSpotify } from '../audio/spotify-auth.ts';
import { useT } from '../store.ts';
import { readLatency } from './format.ts';
import { BeatDots } from './TrackSummary.tsx';
import { useBeatClock } from './useBeatClock.ts';

type Remote = ClockSource & { stop(): void };

async function openRemote(track: Track, box: HTMLElement): Promise<Remote | null> {
  if (track.source.kind === 'youtube') {
    const holder = document.createElement('div');
    box.replaceChildren(holder);
    const yt = await YouTubeSource.create(holder, track.source.videoId);
    yt.play();
    return Object.assign(yt, { stop: () => yt.destroy() });
  }
  if (track.source.kind === 'spotify') {
    const sp = await SpotifySource.connect(spotifyToken);
    await sp.play(track.source.uri);
    return Object.assign(sp, { stop: () => sp.disconnect() });
  }
  return null;
}

/**
 * Spotify and YouTube give no audio to analyse, so the author taps along on the downbeat and
 * then on every beat; the taps become a beat grid (PLAN §5, ADR 0012).
 */
export function TapCalibration({ track }: { readonly track: Track }) {
  const t = useT();
  const signedIn = useSpotify((s) => s.signedIn);
  const box = useRef<HTMLDivElement>(null);
  const [remote, setRemote] = useState<Remote | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [taps, setTaps] = useState<number[]>([]);
  const [beatsPerBar, setBeatsPerBar] = useState(track.calibration?.beatsPerBar ?? 4);
  const map = useMemo(
    () => (track.calibration ? TempoMap.fromCalibration(track.calibration) : null),
    [track.calibration],
  );
  const reading = useBeatClock(remote, map, false);

  useEffect(() => () => remote?.stop(), [remote]);

  const needsSignIn = track.source.kind === 'spotify' && !signedIn;
  const start = async () => {
    if (!box.current) return;
    setStatus('loading');
    try {
      setRemote(await openRemote(track, box.current));
      setStatus('idle');
    } catch (error) {
      console.warn(error);
      setStatus('error');
    }
  };
  const tap = () => {
    if (!remote?.playing) return;
    setTaps((list) => [...list.slice(-63), remote.position() - readLatency()]);
  };
  const grid = tapGrid(taps, beatsPerBar);

  return (
    <div className="tap-calibration" data-testid="tap-calibration">
      <div
        ref={box}
        className="tap-calibration__player"
        hidden={track.source.kind !== 'youtube' || !remote}
      />
      {needsSignIn ? (
        <p className="hint">{t('sound.spotifySignInFirst')}</p>
      ) : !remote ? (
        <button
          type="button"
          className="ie-button"
          disabled={status === 'loading'}
          onClick={() => void start()}
        >
          <Play size={16} strokeWidth={1.5} aria-hidden="true" />
          {status === 'loading' ? t('sound.loadingPlayer') : t('sound.startTapping')}
        </button>
      ) : (
        <>
          <p className="hint">{t('sound.tapHint')}</p>
          <div className="beat-check__bar">
            <button
              type="button"
              className="ie-button tap-button"
              onPointerDown={tap}
              data-testid="tap"
            >
              <Hand size={16} strokeWidth={1.5} aria-hidden="true" />
              {t('sound.tap', { count: taps.length })}
            </button>
            <select
              className="picker"
              aria-label={t('sound.beatsPerBar')}
              value={beatsPerBar}
              onChange={(e) => setBeatsPerBar(Number(e.target.value))}
            >
              {[2, 3, 4, 6].map((n) => (
                <option key={n} value={n}>{`${n}/4`}</option>
              ))}
            </select>
            <button
              type="button"
              className="ie-button ie-button--primary"
              disabled={!grid}
              onClick={() => {
                if (!grid) return;
                updateTrack(track.id, (x) => ({ ...x, calibration: grid }));
                setTaps([]);
              }}
            >
              {grid ? t('sound.useTaps', { bpm: Math.round(grid.bpm) }) : t('sound.tapMore')}
            </button>
            {map && (
              <BeatDots
                count={track.calibration?.beatsPerBar ?? 4}
                current={reading?.beat ?? null}
              />
            )}
          </div>
        </>
      )}
      {status === 'error' && (
        <p className="hint" data-error>
          {t('sound.playerFailed')}
        </p>
      )}
    </div>
  );
}
