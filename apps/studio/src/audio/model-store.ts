import type { ModelFile } from '@ie/audio';
import { requestPersistentStorage } from '@ie/core';
import { create, type UseBoundStore, type StoreApi } from 'zustand';
import { audioFiles } from './studio-audio-files.ts';

/*
 * A model downloaded only when the author asks, checked against pinned SHA-256 sums and kept in
 * OPFS beside the imported audio (ADR 0013). Beat This! and the stem model both use it.
 */

export type ModelState =
  | { readonly status: 'checking' | 'absent' | 'ready' }
  | { readonly status: 'downloading'; readonly received: number; readonly total: number }
  | { readonly status: 'error'; readonly message: string };

export interface ModelStore {
  readonly use: UseBoundStore<StoreApi<ModelState>>;
  readonly size: number;
  /** Looks for a complete model on this device (sizes only: the sums were checked on download). */
  readonly check: () => Promise<void>;
  readonly download: () => Promise<void>;
  readonly cancel: () => void;
  readonly remove: () => Promise<void>;
  readonly available: () => boolean;
  /** The files' bytes, in the order they were listed. */
  readonly read: () => Promise<ArrayBuffer[]>;
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

export function createModelStore(dir: string, files: readonly ModelFile[]): ModelStore {
  const use = create<ModelState>()(() => ({ status: 'checking' }));
  const size = files.reduce((sum, f) => sum + f.size, 0);
  const path = (file: ModelFile) => `${dir}/${file.name}`;
  let abort: AbortController | null = null;

  return {
    use,
    size,
    async check() {
      try {
        const store = await audioFiles();
        for (const file of files) {
          const blob = await store.read(path(file));
          if (blob?.size !== file.size) return use.setState({ status: 'absent' });
        }
        use.setState({ status: 'ready' });
      } catch {
        use.setState({ status: 'absent' });
      }
    },
    async download() {
      if (use.getState().status === 'downloading') return;
      abort = new AbortController();
      const { signal } = abort;
      let received = 0;
      use.setState({ status: 'downloading', received, total: size });
      try {
        // A model this size should survive the browser clearing space.
        await requestPersistentStorage();
        const store = await audioFiles();
        for (const file of files) {
          const blob = await fetchFile(file, signal, (n) => {
            received += n;
            use.setState({ status: 'downloading', received, total: size });
          });
          await store.write(path(file), blob);
        }
        use.setState({ status: 'ready' });
      } catch (error) {
        if (signal.aborted) use.setState({ status: 'absent' });
        else
          use.setState({
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
      } finally {
        abort = null;
      }
    },
    cancel() {
      abort?.abort();
    },
    async remove() {
      const store = await audioFiles();
      for (const file of files) await store.delete(path(file)).catch(() => undefined);
      use.setState({ status: 'absent' });
    },
    available: () => use.getState().status === 'ready',
    async read() {
      const store = await audioFiles();
      return Promise.all(
        files.map(async (file) => {
          const blob = await store.read(path(file));
          if (!blob) throw new Error(`${file.name} is missing.`);
          return blob.arrayBuffer();
        }),
      );
    },
  };
}
