import type { InferenceSession, Tensor } from 'onnxruntime-web';
import { DEMUCS, STEMS, type Stem } from './model.ts';
import { modelInput, segmentStarts, segmentWeight, stemOutput } from './spec.ts';
import { loadOrt } from '../ort.ts';

const S = DEMUCS.segment;

export interface StereoStem {
  readonly left: Float32Array;
  readonly right: Float32Array;
}

/** A loaded HTDemucs network. Creating one parses ~180 MB, so the worker keeps it. */
export interface DemucsRunner {
  readonly provider: string;
  /** Splits a 44.1 kHz stereo song into the stems asked for (all four by default). */
  separate(
    left: Float32Array,
    right: Float32Array,
    options?: {
      readonly stems?: readonly Stem[];
      readonly progress?: (done: number, total: number) => void;
    },
  ): Promise<Partial<Record<Stem, StereoStem>>>;
}

export async function loadDemucs(onnx: ArrayBuffer): Promise<DemucsRunner> {
  const ort = await loadOrt();
  ort.env.logLevel = 'error';
  const gpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
  let provider = gpu ? 'webgpu' : 'wasm';
  let session: InferenceSession;
  try {
    session = await ort.InferenceSession.create(new Uint8Array(onnx), {
      executionProviders: [provider],
    });
  } catch (error) {
    if (provider === 'wasm') throw error;
    provider = 'wasm';
    session = await ort.InferenceSession.create(new Uint8Array(onnx), {
      executionProviders: ['wasm'],
    });
  }
  const [waveName, specName] = session.inputNames;
  if (!waveName) throw new Error('The stem model has no inputs.');

  return {
    provider,
    async separate(left, right, options = {}) {
      const wanted = options.stems ?? STEMS;
      const length = Math.min(left.length, right.length);
      const starts = segmentStarts(length);
      const sums = new Map<Stem, { left: Float32Array; right: Float32Array }>();
      for (const stem of wanted)
        sums.set(stem, { left: new Float32Array(length), right: new Float32Array(length) });
      const weights = new Float32Array(length);

      for (let s = 0; s < starts.length; s++) {
        options.progress?.(s, starts.length);
        const start = starts[s] ?? 0;
        const end = Math.min(start + S, length);
        const input = modelInput(left.subarray(start, end), right.subarray(start, end));
        const feeds: Record<string, Tensor> = {
          [waveName]: new ort.Tensor('float32', input.waveform, [1, 2, S]),
        };
        if (specName)
          feeds[specName] = new ort.Tensor('float32', input.spec, [
            1,
            4,
            DEMUCS.bins,
            DEMUCS.frames,
          ]);
        const out = await session.run(feeds);
        // The export's output names aren't documented; its two branches differ in rank.
        let time: Float32Array | null = null;
        let freq: Float32Array | null = null;
        for (const tensor of Object.values(out)) {
          if (tensor.dims.length === 4 && tensor.dims[2] === 2)
            time = (await tensor.getData()) as Float32Array;
          else if (tensor.dims.length === 5 && tensor.dims[2] === 4)
            freq = (await tensor.getData()) as Float32Array;
        }
        if (!time || !freq) throw new Error('The stem model answered in an unknown shape.');
        for (const stem of wanted) {
          const sum = sums.get(stem);
          if (!sum) continue;
          const part = stemOutput(freq, time, STEMS.indexOf(stem));
          for (let i = 0; i < end - start; i++) {
            const w = segmentWeight(i);
            sum.left[start + i] = (sum.left[start + i] ?? 0) + (part.left[i] ?? 0) * w;
            sum.right[start + i] = (sum.right[start + i] ?? 0) + (part.right[i] ?? 0) * w;
          }
        }
        for (let i = 0; i < end - start; i++)
          weights[start + i] = (weights[start + i] ?? 0) + segmentWeight(i);
      }
      options.progress?.(starts.length, starts.length);

      const result: Partial<Record<Stem, StereoStem>> = {};
      for (const [stem, sum] of sums) {
        for (let i = 0; i < length; i++) {
          const w = weights[i] ?? 0;
          if (w > 0) {
            sum.left[i] = (sum.left[i] ?? 0) / w;
            sum.right[i] = (sum.right[i] ?? 0) / w;
          }
        }
        result[stem] = sum;
      }
      return result;
    },
  };
}
