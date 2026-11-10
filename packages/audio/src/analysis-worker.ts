import type { BeatThisRunner } from './beat-this/infer.ts';
import { BEAT_THIS, BEAT_THIS_TRACKER, type BeatThisModel } from './beat-this/model.ts';
import { analyzeSamples, completeAnalysis } from './dsp/analyze.ts';
import type { AnalysisRequest, AnalysisResponse } from './analyzer.ts';

/*
 * Beat analysis off the main thread. The page decodes the file (only the main thread has
 * decodeAudioData) and transfers mono samples here; the result goes back as plain data.
 * Beat This! is loaded the first time it's asked for and kept; if it fails, the DSP tracker
 * answers instead and the reason goes back with the result.
 */
interface WorkerScope {
  onmessage: ((event: MessageEvent<AnalysisRequest>) => void) | null;
  postMessage(message: AnalysisResponse): void;
}
const scope = self as unknown as WorkerScope;

let model: BeatThisModel | null = null;
let runner: Promise<BeatThisRunner> | null = null;

function beatThis(): Promise<BeatThisRunner> {
  if (!runner) {
    if (!model) return Promise.reject(new Error('The Beat This! model is not loaded.'));
    const loading = model;
    runner = import('./beat-this/infer.ts').then((m) => m.loadBeatThis(loading));
    // A failed load can be retried on the next song (after a GPU reset, say).
    runner.catch(() => (runner = null));
  }
  return runner;
}

// Queued, so a second song waits for the first instead of sharing the network.
let queue: Promise<void> = Promise.resolve();

scope.onmessage = (event) => {
  const request = event.data;
  if (request.kind === 'model') {
    model = request.model;
    runner = null;
    return;
  }
  queue = queue.then(() => analyze(request));
};

async function analyze(request: Extract<AnalysisRequest, { kind: 'analyze' }>): Promise<void> {
  const { id, samples, sampleRate } = request;
  const post = (message: AnalysisResponse) => scope.postMessage(message);
  let fallback: string | undefined;
  try {
    if (request.tracker === 'beat-this' && sampleRate === BEAT_THIS.sampleRate) {
      try {
        post({ id, kind: 'progress', stage: 'network', fraction: 0 });
        const network = await beatThis();
        const grid = await network.track(samples, (done, total) =>
          post({ id, kind: 'progress', stage: 'network', fraction: done / total }),
        );
        if (grid.beats.length >= 2) {
          post({ id, kind: 'progress', stage: 'harmony' });
          const beats = grid.beats.map((f) => f / BEAT_THIS.fps);
          const downbeats = grid.numbers.flatMap((n, i) => (n === 1 ? [i] : []));
          const analysis = completeAnalysis(
            samples,
            sampleRate,
            { beats, downbeats, beatsPerBar: grid.beatsPerBar },
            BEAT_THIS_TRACKER,
          );
          post({ id, kind: 'done', analysis });
          return;
        }
        fallback = 'Beat This! found no beats.';
      } catch (error) {
        fallback = error instanceof Error ? error.message : String(error);
      }
    }
    const analysis = analyzeSamples(samples, sampleRate, (stage) =>
      post({ id, kind: 'progress', stage }),
    );
    post({ id, kind: 'done', analysis, ...(fallback ? { fallback } : {}) });
  } catch (error) {
    post({ id, kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
}
