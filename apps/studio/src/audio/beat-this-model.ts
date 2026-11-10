import { BEAT_THIS_FILES, BEAT_THIS_SIZE, type BeatThisSource, type ModelFile } from '@ie/audio';
import { requestPersistentStorage } from '@ie/core';
import { create } from 'zustand';
import { audioFiles } from './studio-audio-files.ts';

/*
 * The Beat This! model, downloaded only when the author asks (about 190 MB from Hugging Face),
 * checked against pinned SHA-256 sums and kept in OPFS beside the imported audio (ADR 0013).
 */

export type ModelState =
  | { readonly status: 'checking' | 'absent' | 'ready' }
  | { readonly status: 'downloading'; readonly received: number; readonly total: number }
  | { readonly status: 'error'; readonly message: string };

export const useBeatThisModel = create<ModelState>()(() => ({ status: 'checking' }));

const DIR = 'models/beat-this';
const path = (file: ModelFile) => `${DIR}/${file.name}`;
let abort: AbortController | null = null;

/** Looks for a complete model on this device (sizes only: the sums were checked on download). */
export async function checkBeatThisModel(): Promise<void> {
  try {
    const store = await audioFiles();
    for (const file of BEAT_THIS_FILES) {
      const blob = await store.read(path(file));
      if (blob?.size !== file.size) return useBeatThisModel.setState({ status: 'absent' });
    }
    useBeatThisModel.setState({ status: 'ready' });
  } catch {
    useBeatThisModel.setState({ status: 'absent' });
  }
}

async function sha256(data: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function fetchFile(
  file: ModelFile,
  signal: AbortSignal,
  onBytes: (n: number) => void,
): Promise<Blob> {
  const response = await fetch(file.url, { signal });
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
  const reader = response.body.getReader();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    onBytes(value.byteLength);
  }
  const blob = new Blob(parts);
  if (blob.size !== file.size || (await sha256(await blob.arrayBuffer())) !== file.sha256)
    throw new Error('checksum');
  return blob;
}

export async function downloadBeatThisModel(): Promise<void> {
  if (useBeatThisModel.getState().status === 'downloading') return;
  abort = new AbortController();
  const { signal } = abort;
  let received = 0;
  useBeatThisModel.setState({ status: 'downloading', received, total: BEAT_THIS_SIZE });
  try {
    // A model this size should survive the browser clearing space.
    await requestPersistentStorage();
    const store = await audioFiles();
    for (const file of BEAT_THIS_FILES) {
      const blob = await fetchFile(file, signal, (n) => {
        received += n;
        useBeatThisModel.setState({ status: 'downloading', received, total: BEAT_THIS_SIZE });
      });
      await store.write(path(file), blob);
    }
    useBeatThisModel.setState({ status: 'ready' });
  } catch (error) {
    if (signal.aborted) useBeatThisModel.setState({ status: 'absent' });
    else
      useBeatThisModel.setState({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
  } finally {
    abort = null;
  }
}

export function cancelBeatThisDownload(): void {
  abort?.abort();
}

export async function removeBeatThisModel(): Promise<void> {
  const store = await audioFiles();
  for (const file of BEAT_THIS_FILES) await store.delete(path(file)).catch(() => undefined);
  useBeatThisModel.setState({ status: 'absent' });
}

/** The analyzer's view of the model. */
export const beatThisSource: BeatThisSource = {
  available: () => useBeatThisModel.getState().status === 'ready',
  async load() {
    const store = await audioFiles();
    const [onnx, filterbank] = await Promise.all(
      BEAT_THIS_FILES.map(async (file) => {
        const blob = await store.read(path(file));
        if (!blob) throw new Error('The Beat This! model is missing.');
        return blob.arrayBuffer();
      }),
    );
    if (!onnx || !filterbank) throw new Error('The Beat This! model is missing.');
    return { onnx, filterbank };
  },
};
