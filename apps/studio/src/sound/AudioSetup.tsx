import { measureLatency } from '@ie/audio';
import { Hand, LogIn, LogOut, Timer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { engine } from '../audio/studio-audio.ts';
import {
  setSpotifyClientId,
  signOutSpotify,
  spotifyClientId,
  spotifyRedirectUri,
  startSpotifySignIn,
  useSpotify,
} from '../audio/spotify-auth.ts';
import { useT } from '../store.ts';
import { BeatThisSetup } from './BeatThisSetup.tsx';
import { StemsSetup } from './StemsSetup.tsx';
import { readLatency, writeLatency } from './format.ts';

const CLICKS = 12;
const GAP = 0.6;

/**
 * Tap along to a dozen clicks; the median lag is how late this device (and its author) registers
 * taps, and tap calibration subtracts it.
 */
function LatencyTest() {
  const t = useT();
  const [latency, setLatency] = useState(readLatency);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);
  const test = useRef<{ clicks: number[]; taps: number[] } | null>(null);

  useEffect(() => () => void (test.current = null), []);

  const start = async () => {
    await engine.resume();
    const ctx = engine.context;
    const rate = ctx.sampleRate;
    const samples = new Float32Array(Math.round(rate * 0.03));
    for (let i = 0; i < samples.length; i++)
      samples[i] = Math.sin((2 * Math.PI * 1500 * i) / rate) * Math.exp(-i / (rate * 0.006));
    const buffer = engine.buffer(samples, rate);
    const first = ctx.currentTime + 1;
    const clicks: number[] = [];
    for (let i = 0; i < CLICKS; i++) {
      const at = first + i * GAP;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(engine.input('ui'));
      source.start(at);
      clicks.push(at + engine.outputLatency);
    }
    test.current = { clicks, taps: [] };
    setRunning(true);
    setFailed(false);
    setTimeout(
      () => {
        const done = test.current;
        test.current = null;
        setRunning(false);
        const measured = done ? measureLatency(done.clicks, done.taps) : null;
        if (measured === null) return setFailed(true);
        writeLatency(measured);
        setLatency(measured);
      },
      (1 + CLICKS * GAP + 0.5) * 1000,
    );
  };

  return (
    <section className="card">
      <h3 className="card__title">{t('sound.latency')}</h3>
      <p className="hint">{t('sound.latencyHint')}</p>
      <div className="page__actions">
        {running ? (
          <button
            type="button"
            className="ie-button ie-button--primary tap-button"
            onPointerDown={() => test.current?.taps.push(engine.context.currentTime)}
          >
            <Hand size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('sound.tapNow')}
          </button>
        ) : (
          <button type="button" className="ie-button" onClick={() => void start()}>
            <Timer size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('sound.latencyStart')}
          </button>
        )}
        <span className="hint" data-testid="latency">
          {t('sound.latencyValue', { ms: Math.round(latency * 1000) })}
        </span>
      </div>
      {failed && (
        <p className="hint" data-error>
          {t('sound.latencyFailed')}
        </p>
      )}
    </section>
  );
}

/** Spotify for private playthroughs: the author's own client ID and sign-in (ADR 0012). */
function SpotifySetup() {
  const t = useT();
  const { signedIn, error } = useSpotify();
  const [clientId, setClientId] = useState(spotifyClientId);
  return (
    <section className="card">
      <h3 className="card__title">{t('sound.spotify')}</h3>
      <p className="hint">{t('sound.spotifyHint', { uri: spotifyRedirectUri() })}</p>
      <label className="labelled">
        <span className="ie-label">{t('sound.spotifyClientId')}</span>
        <input
          className="field field--mono"
          value={clientId}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setClientId(e.target.value);
            setSpotifyClientId(e.target.value);
          }}
        />
      </label>
      <div className="page__actions">
        {signedIn ? (
          <button type="button" className="ie-button" onClick={() => void signOutSpotify()}>
            <LogOut size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('sound.spotifySignOut')}
          </button>
        ) : (
          <button
            type="button"
            className="ie-button"
            disabled={!clientId.trim()}
            onClick={() => void startSpotifySignIn()}
          >
            <LogIn size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('sound.spotifySignIn')}
          </button>
        )}
        <span className="hint">{signedIn ? t('sound.spotifyConnected') : ''}</span>
      </div>
      {error && (
        <p className="hint" data-error>
          {t('sound.spotifyFailed')}
        </p>
      )}
    </section>
  );
}

export function AudioSetup() {
  return (
    <div className="cards" data-testid="audio-setup">
      <BeatThisSetup />
      <StemsSetup />
      <LatencyTest />
      <SpotifySetup />
    </div>
  );
}
