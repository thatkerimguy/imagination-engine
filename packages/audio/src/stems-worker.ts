import { DEMUCS } from './stems/model.ts';
import type { DemucsRunner } from './stems/separate.ts';
import type { StemsRequest, StemsResponse } from './stems/client.ts';

/*
 * Stem separation off the main thread (ADR 0028). The page decodes the song to 44.1 kHz stereo
 * and transfers it here with the model; drum hits go back as plain data.
 */
interface WorkerScope {
  onmessage: ((event: MessageEvent<StemsRequest>) => void) | null;
  postMessage(message: StemsResponse): void;
}
const scope = self as unknown as WorkerScope;

let onnx: ArrayBuffer | null = null;
let runner: Promise<DemucsRunner> | null = null;

function demucs(): Promise<DemucsRunner> {
  if (!runner) {
    if (!onnx) return Promise.reject(new Error('The stem model is not loaded.'));
    const loading = onnx;
    runner = import('./stems/separate.ts').then((m) => m.loadDemucs(loading));
    runner.catch(() => (runner = null));
  }
  return runner;
}

let queue: Promise<void> = Promise.resolve();

scope.onmessage = (event) => {
  const request = event.data;
  if (request.kind === 'model') {
    onnx = request.onnx;
    runner = null;
    return;
  }
  queue = queue.then(() => drums(request));
};

async function drums(request: Extract<StemsRequest, { kind: 'drums' }>): Promise<void> {
  const { id } = request;
  const post = (message: StemsResponse) => scope.postMessage(message);
  try {
    post({ id, kind: 'progress', fraction: 0 });
    const network = await demucs();
    const stems = await network.separate(request.left, request.right, {
      stems: ['drums'],
      progress: (done, total) => post({ id, kind: 'progress', fraction: done / total }),
    });
    const drum = stems.drums;
    if (!drum) throw new Error('No drum stem.');
    const mono = new Float32Array(drum.left.length);
    for (let i = 0; i < mono.length; i++)
      mono[i] = ((drum.left[i] ?? 0) + (drum.right[i] ?? 0)) / 2;
    const { drumHits } = await import('./stems/hits.ts');
    post({ id, kind: 'done', hits: drumHits(mono, DEMUCS.sampleRate), provider: network.provider });
  } catch (error) {
    post({ id, kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
}
