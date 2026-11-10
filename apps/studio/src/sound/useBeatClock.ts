import { Conductor, type ClockSource, type TempoMap } from '@ie/audio';
import { useEffect, useRef, useState } from 'react';
import { engine } from '../audio/studio-audio.ts';

export interface BeatReading {
  readonly time: number;
  readonly bar: number;
  /** Whole beat within the bar, 0 = downbeat. */
  readonly beat: number;
}

let clicks: { accent: AudioBuffer; beat: AudioBuffer } | null = null;

/** A short sine tick; the downbeat one is higher, like a metronome. */
function clickBuffers(): { accent: AudioBuffer; beat: AudioBuffer } {
  if (clicks) return clicks;
  const make = (hz: number) => {
    const rate = 44100;
    const samples = new Float32Array(Math.round(rate * 0.04));
    for (let i = 0; i < samples.length; i++)
      samples[i] = Math.sin((2 * Math.PI * hz * i) / rate) * Math.exp(-i / (rate * 0.008)) * 0.6;
    return engine.buffer(samples, rate);
  };
  clicks = { accent: make(1760), beat: make(1320) };
  return clicks;
}

/**
 * Follows a playing source through a conductor and reports bar and beat each time they change,
 * with an optional metronome click: the "does the grid sit on the music?" check.
 */
export function useBeatClock(
  source: ClockSource | null,
  map: TempoMap | null,
  click: boolean,
): BeatReading | null {
  const [reading, setReading] = useState<BeatReading | null>(null);
  const clickRef = useRef(click);
  useEffect(() => {
    clickRef.current = click;
  }, [click]);

  useEffect(() => {
    if (!source || !map) return;
    // No latency correction: the clicks go out through the same speakers as the music, so they
    // line up with it when they are triggered on the source's own beat.
    const conductor = new Conductor(map, source);
    let frame = 0;
    let lastBeat = Number.NaN;
    let lastDraw = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!source.playing) return;
      const time = conductor.time();
      const position = conductor.position();
      const whole = Math.floor(map.beatAt(time));
      const changed = whole !== lastBeat;
      if (changed && !Number.isNaN(lastBeat) && clickRef.current) {
        const { accent, beat } = clickBuffers();
        engine.play(Math.floor(position.beat) === 0 ? accent : beat, 'ui', 0.7);
      }
      lastBeat = whole;
      // A re-render per beat, plus a few a second for the playhead.
      if (changed || now - lastDraw > 120) {
        lastDraw = now;
        setReading({ time, bar: position.bar, beat: Math.floor(position.beat) });
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      setReading(null);
    };
  }, [source, map]);

  return reading;
}
