import type { InferenceSession } from 'onnxruntime-web';
import { aggregate, windowAt, windowStarts } from './chunks.ts';
import { trackDownbeats, type DbnResult } from './dbn.ts';
import { logMelSpectrogram } from './melspec.ts';
import { BEAT_THIS, type BeatThisModel } from './model.ts';

/** A loaded Beat This! network. Creating one parses ~190 MB, so the worker keeps it. */
export interface BeatThisRunner {
  /** 'webgpu' on most desktops; 'wasm' (about 12× slower) otherwise. */
  readonly provider: string;
  track(
    samples: Float32Array,
    progress?: (done: number, total: number) => void,
  ): Promise<DbnResult>;
}

export async function loadBeatThis(model: BeatThisModel): Promise<BeatThisRunner> {
  // Loaded on demand, so nothing of onnxruntime reaches the Player or the DSP path.
  const ort = await import('onnxruntime-web/webgpu');
  // The export leaves a few unused initializers, which onnxruntime reports as console errors.
  ort.env.logLevel = 'error';
  const filterbank = new Float32Array(model.filterbank);
  const gpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
  let session: InferenceSession;
  let provider = gpu ? 'webgpu' : 'wasm';
  try {
    session = await ort.InferenceSession.create(new Uint8Array(model.onnx), {
      executionProviders: [provider],
    });
  } catch (error) {
    if (provider === 'wasm') throw error;
    provider = 'wasm';
    session = await ort.InferenceSession.create(new Uint8Array(model.onnx), {
      executionProviders: ['wasm'],
    });
  }

  return {
    provider,
    async track(samples, progress) {
      const { frames, data } = logMelSpectrogram(samples, filterbank);
      const starts = windowStarts(frames);
      const beat: Float32Array[] = [];
      const downbeat: Float32Array[] = [];
      for (let w = 0; w < starts.length; w++) {
        progress?.(w, starts.length);
        const input = windowAt(data, frames, starts[w] ?? 0);
        // One window per call: batching them all builds a huge time-attention tensor.
        const out = await session.run({
          spect: new ort.Tensor('float32', input, [1, BEAT_THIS.chunk, BEAT_THIS.mels]),
        });
        beat.push(Float32Array.from((await out.beat?.getData()) as Float32Array));
        downbeat.push(Float32Array.from((await out.downbeat?.getData()) as Float32Array));
      }
      progress?.(starts.length, starts.length);
      return trackDownbeats(aggregate(beat, starts, frames), aggregate(downbeat, starts, frames), {
        fps: BEAT_THIS.fps,
      });
    },
  };
}
