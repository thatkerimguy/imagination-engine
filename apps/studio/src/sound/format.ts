import { PITCH_CLASSES, type TrackAnalysis } from '@ie/story';
import { readPref, writePref } from '@ie/ui-kit';

/** `m:ss` for a duration or position in seconds. */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Pitch-class name and mode, e.g. `{ tonic: 'A', mode: 'minor' }`. */
export function keyParts(
  key: TrackAnalysis['key'],
): { tonic: string; mode: 'major' | 'minor' } | null {
  return key ? { tonic: PITCH_CLASSES[key.tonic] ?? '?', mode: key.mode } : null;
}

/** Which beat of the bar a beat index falls on (0 = downbeat), from the analysis's downbeats. */
export function beatInBar(analysis: TrackAnalysis, beatIndex: number): number {
  let last = -1;
  for (const d of analysis.downbeats) {
    if (d > beatIndex) break;
    last = d;
  }
  if (last < 0) {
    const first = analysis.downbeats[0] ?? 0;
    const n = analysis.beatsPerBar;
    return (((beatIndex - first) % n) + n) % n;
  }
  return (beatIndex - last) % analysis.beatsPerBar;
}

const LATENCY_KEY = 'ie.studio.audioLatency';

/** How late this device registers a tap after the sound is heard, in seconds (0 until measured). */
export function readLatency(): number {
  const v = Number(readPref(LATENCY_KEY) ?? '0');
  return Number.isFinite(v) && Math.abs(v) < 0.5 ? v : 0;
}

export function writeLatency(seconds: number): void {
  writePref(LATENCY_KEY, String(Math.round(seconds * 1000) / 1000));
}
