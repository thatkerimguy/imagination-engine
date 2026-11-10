import { readParsed, type KeyValueStore } from '@ie/core';
import { trackAnalysisSchema, type TrackAnalysis } from '@ie/story';
import { BEAT_THIS_TRACKER, type BeatThisModel } from './beat-this/model.ts';
import { DSP_TRACKER, type AnalysisStage } from './dsp/analyze.ts';

/** Analysis runs at this rate: plenty for beats and pitch, a quarter of the work of 44.1 kHz. */
export const ANALYSIS_RATE = 22050;

export type AnalysisRequest =
  | {
      readonly kind: 'analyze';
      readonly id: number;
      readonly samples: Float32Array;
      readonly sampleRate: number;
      /** Beat This! when the worker has its model; the DSP tracker otherwise or if it fails. */
      readonly tracker: 'beat-this' | 'dsp';
    }
  | { readonly kind: 'model'; readonly model: BeatThisModel };

export type AnalysisResponse =
  | {
      readonly id: number;
      readonly kind: 'progress';
      readonly stage: AnalysisStage;
      /** How far through the stage, 0..1, where that is known. */
      readonly fraction?: number;
    }
  | {
      readonly id: number;
      readonly kind: 'done';
      readonly analysis: TrackAnalysis;
      /** Why Beat This! wasn't used though it was asked for (the DSP tracker filled in). */
      readonly fallback?: string;
    }
  | { readonly id: number; readonly kind: 'error'; readonly message: string };

export type AnalysisProgress = 'decoding' | AnalysisStage;
export type ProgressCallback = (stage: AnalysisProgress, fraction?: number) => void;

/** Where the host keeps the Beat This! model (the Studio downloads it on request). */
export interface BeatThisSource {
  available(): boolean;
  load(): Promise<BeatThisModel>;
}

export interface AnalysisOutcome {
  readonly analysis: TrackAnalysis;
  readonly fallback?: string;
}

/** Decodes any format the browser can play into mono samples at `rate`. */
export async function decodeMono(data: ArrayBuffer, rate = ANALYSIS_RATE): Promise<Float32Array> {
  // decodeAudioData resamples to its context's rate, so a tiny offline context does the work.
  const buffer = await new OfflineAudioContext(1, 1, rate).decodeAudioData(data);
  // The arithmetic mean of the channels: Beat This! was trained on exactly this downmix.
  const mono = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const channel = buffer.getChannelData(c);
    for (let i = 0; i < mono.length; i++)
      mono[i] = (mono[i] ?? 0) + (channel[i] ?? 0) / buffer.numberOfChannels;
  }
  return mono;
}

/** A short content hash: the cache key, so the same file is analysed once however it's named. */
export async function contentHash(data: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return [...digest.slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Analysis results by content hash and tracker, so re-importing or re-opening never repeats the
 * work, and a better tracker analyses everything afresh.
 */
export class AnalysisCache {
  constructor(private readonly store: KeyValueStore) {}

  get(hash: string, tracker: string): Promise<TrackAnalysis | undefined> {
    // An unreadable entry (an older format) just means analysing again.
    return readParsed(this.store, `analysis:${tracker}:${hash}`, trackAnalysisSchema).then(
      (a) => a as TrackAnalysis | undefined,
      () => undefined,
    );
  }

  set(hash: string, analysis: TrackAnalysis): Promise<void> {
    return this.store.set(`analysis:${analysis.tracker}:${hash}`, analysis);
  }
}

/**
 * Runs beat analysis in a worker. The host passes a worker factory (in Vite, an import with
 * `?worker`), so the package itself makes no assumptions about bundling.
 */
export class Analyzer {
  private worker: Worker | null = null;
  private modelSent = false;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    {
      resolve: (a: AnalysisOutcome) => void;
      reject: (e: Error) => void;
      progress?: ProgressCallback;
    }
  >();

  constructor(
    private readonly createWorker: () => Worker,
    private readonly cache?: AnalysisCache,
    private readonly beatThis?: BeatThisSource,
  ) {}

  /** The tracker an analysis would use now: Beat This! once its model is on this device. */
  tracker(): string {
    return this.beatThis?.available() ? BEAT_THIS_TRACKER : DSP_TRACKER;
  }

  async analyze(data: ArrayBuffer, progress?: ProgressCallback): Promise<AnalysisOutcome> {
    const hash = await contentHash(data);
    const useBeatThis = this.tracker() === BEAT_THIS_TRACKER;
    // A Beat This! result is preferred even where the model isn't downloaded.
    for (const tracker of useBeatThis ? [BEAT_THIS_TRACKER] : [BEAT_THIS_TRACKER, DSP_TRACKER]) {
      const cached = await this.cache?.get(hash, tracker);
      if (cached) return { analysis: cached };
    }
    progress?.('decoding');
    // Note: decodeAudioData detaches `data`; callers keep their own copy if they need it.
    const samples = await decodeMono(data);
    const outcome = await this.run(samples, useBeatThis, progress);
    await this.cache?.set(hash, outcome.analysis);
    return outcome;
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.modelSent = false;
    for (const p of this.pending.values()) p.reject(new Error('Analysis was cancelled.'));
    this.pending.clear();
  }

  private async run(
    samples: Float32Array,
    useBeatThis: boolean,
    progress?: ProgressCallback,
  ): Promise<AnalysisOutcome> {
    const worker = this.ensureWorker();
    let tracker: 'beat-this' | 'dsp' = 'dsp';
    let fallback: string | undefined;
    if (useBeatThis && this.beatThis) {
      try {
        if (!this.modelSent) {
          // The model moves to the worker, which keeps it for every later analysis.
          const model = await this.beatThis.load();
          const message: AnalysisRequest = { kind: 'model', model };
          worker.postMessage(message, [model.onnx, model.filterbank]);
          this.modelSent = true;
        }
        tracker = 'beat-this';
      } catch (error) {
        fallback = error instanceof Error ? error.message : String(error);
      }
    }
    const id = this.nextId++;
    const outcome = await new Promise<AnalysisOutcome>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, ...(progress ? { progress } : {}) });
      const request: AnalysisRequest = {
        kind: 'analyze',
        id,
        samples,
        sampleRate: ANALYSIS_RATE,
        tracker,
      };
      worker.postMessage(request, [samples.buffer]);
    });
    return fallback && !outcome.fallback ? { ...outcome, fallback } : outcome;
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    worker.onmessage = (event: MessageEvent<AnalysisResponse>) => {
      const message = event.data;
      const job = this.pending.get(message.id);
      if (!job) return;
      if (message.kind === 'progress') job.progress?.(message.stage, message.fraction);
      else {
        this.pending.delete(message.id);
        if (message.kind === 'done')
          job.resolve({
            analysis: message.analysis,
            ...(message.fallback ? { fallback: message.fallback } : {}),
          });
        else job.reject(new Error(message.message));
      }
    };
    worker.onerror = (event) => {
      for (const job of this.pending.values()) job.reject(new Error(event.message));
      this.pending.clear();
      this.worker = null;
      this.modelSent = false;
    };
    this.worker = worker;
    return worker;
  }
}
