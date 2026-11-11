import { DEMUCS } from './model.ts';

export type StemsRequest =
  | { readonly kind: 'model'; readonly onnx: ArrayBuffer }
  | {
      readonly kind: 'drums';
      readonly id: number;
      readonly left: Float32Array;
      readonly right: Float32Array;
    };

export type StemsResponse =
  | { readonly id: number; readonly kind: 'progress'; readonly fraction: number }
  | {
      readonly id: number;
      readonly kind: 'done';
      readonly hits: readonly number[];
      readonly provider: string;
    }
  | { readonly id: number; readonly kind: 'error'; readonly message: string };

/** Where the host keeps the stem model (the Studio downloads it on request). */
export interface StemModelSource {
  available(): boolean;
  load(): Promise<ArrayBuffer>;
}

/** Decodes any playable format into 44.1 kHz stereo (mono files are copied to both sides). */
export async function decodeStereo(
  data: ArrayBuffer,
): Promise<{ left: Float32Array; right: Float32Array }> {
  const buffer = await new OfflineAudioContext(2, 1, DEMUCS.sampleRate).decodeAudioData(data);
  const left = buffer.getChannelData(0).slice();
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1).slice() : left.slice();
  return { left, right };
}

/**
 * Separates songs in a worker and returns the drum hits (ADR 0028). The host passes a worker
 * factory, as with the beat analyzer, and the model source.
 */
export class StemSeparator {
  private worker: Worker | null = null;
  private modelSent = false;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    {
      resolve: (hits: readonly number[]) => void;
      reject: (e: Error) => void;
      progress?: (fraction: number) => void;
    }
  >();

  constructor(
    private readonly createWorker: () => Worker,
    private readonly model: StemModelSource,
  ) {}

  /** Drum hits, in seconds, of a song's raw bytes. */
  async drumHits(data: ArrayBuffer, progress?: (fraction: number) => void): Promise<number[]> {
    if (!this.model.available()) throw new Error('The stem model is not on this device.');
    const { left, right } = await decodeStereo(data);
    const worker = this.ensureWorker();
    if (!this.modelSent) {
      const onnx = await this.model.load();
      worker.postMessage({ kind: 'model', onnx } satisfies StemsRequest, [onnx]);
      this.modelSent = true;
    }
    const id = this.nextId++;
    const hits = await new Promise<readonly number[]>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, ...(progress ? { progress } : {}) });
      worker.postMessage({ kind: 'drums', id, left, right } satisfies StemsRequest, [
        left.buffer,
        right.buffer,
      ]);
    });
    return [...hits];
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.modelSent = false;
    for (const p of this.pending.values()) p.reject(new Error('Stem separation was cancelled.'));
    this.pending.clear();
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    worker.onmessage = (event: MessageEvent<StemsResponse>) => {
      const message = event.data;
      const job = this.pending.get(message.id);
      if (!job) return;
      if (message.kind === 'progress') job.progress?.(message.fraction);
      else {
        this.pending.delete(message.id);
        if (message.kind === 'done') job.resolve(message.hits);
        else job.reject(new Error(message.message));
      }
    };
    worker.onerror = (event) => {
      for (const p of this.pending.values()) p.reject(new Error(event.message));
      this.pending.clear();
      this.dispose();
    };
    this.worker = worker;
    return worker;
  }
}
