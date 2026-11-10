import type { TrackAnalysis } from '@ie/story';
import { estimatePeriod, fitTempo, refineBeats, trackBeats } from './beats.ts';
import { extractFeatures, normalizeOnset, type Features } from './features.ts';
import { estimateKey, findMeter, findSections, peakPerBeat, perBeat } from './harmony.ts';

/** Identifies results of this tracker, so a better one later knows what to re-analyse. */
export const DSP_TRACKER = 'dsp-2';

/**  is Beat This! running; the others are the DSP tracker's steps. */
export type AnalysisStage = 'features' | 'tempo' | 'beats' | 'harmony' | 'network';

/**
 * Beats, downbeats, tempo, key and sections of a mono signal. Pure and synchronous: it runs in
 * the analysis worker, and in tests on synthetic audio.
 */
export function analyzeSamples(
  samples: Float32Array,
  sampleRate: number,
  progress?: (stage: AnalysisStage) => void,
): TrackAnalysis {
  progress?.('features');
  const features = extractFeatures(samples, sampleRate);
  const { fps } = features;
  const onset = normalizeOnset(features.onset, fps);

  progress?.('tempo');
  const period = estimatePeriod(onset, fps);

  progress?.('beats');
  const beatFrames = refineBeats(trackBeats(onset, period), onset);
  const beats = beatFrames.map((f) => round3(f / fps));

  progress?.('harmony');
  const lowPerBeat = peakPerBeat(
    normalizeOnset(features.lowOnset, fps),
    beatFrames,
    Math.max(1, Math.round(fps * 0.07)),
  );
  const meter = findMeter(lowPerBeat, chordsPerBeat(features, beatFrames));
  const downbeats: number[] = [];
  for (let i = meter.phase; i < beats.length; i += meter.beatsPerBar) downbeats.push(i);
  return describe(
    samples.length / sampleRate,
    features,
    beats,
    downbeats,
    meter.beatsPerBar,
    DSP_TRACKER,
  );
}

/** A beat grid from another tracker (Beat This!), completed with tempo, key and sections. */
export function completeAnalysis(
  samples: Float32Array,
  sampleRate: number,
  grid: {
    readonly beats: readonly number[];
    readonly downbeats: readonly number[];
    readonly beatsPerBar: number;
  },
  tracker: string,
): TrackAnalysis {
  const features = extractFeatures(samples, sampleRate);
  return describe(
    samples.length / sampleRate,
    features,
    grid.beats.map(round3),
    [...grid.downbeats],
    grid.beatsPerBar,
    tracker,
  );
}

/** Pitch profile per beat, averaged and clipped: what is clearly sounding, for chord changes. */
function chordsPerBeat(features: Features, beatFrames: readonly number[]): Float32Array {
  return perBeat(features.chroma, beatFrames, 12).map((v) => Math.max(0, v));
}

function describe(
  duration: number,
  features: Features,
  beats: number[],
  downbeats: number[],
  beatsPerBar: number,
  tracker: string,
): TrackAnalysis {
  const beatFrames = beats.map((t) => Math.round(t * features.fps));
  const fit = fitTempo(beats);
  const rmsPerBeat = perBeat(features.rms, beatFrames);
  const sectionBeats = findSections(
    chordsPerBeat(features, beatFrames),
    rmsPerBeat,
    downbeats,
    beatsPerBar,
  );
  const key = estimateKey(features.chroma);
  return {
    v: 1,
    tracker,
    duration: round3(duration),
    bpm: Math.round(fit.bpm * 100) / 100,
    tempo: fit.kind,
    beats,
    downbeats,
    beatsPerBar,
    ...(key ? { key } : {}),
    sections: [0, ...sectionBeats.map((b) => beats[b] ?? 0).filter((t) => t > 0)],
  };
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;
