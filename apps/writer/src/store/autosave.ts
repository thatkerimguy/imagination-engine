// Debounced auto-save. Rapid typing collapses into one write; a write that is still running is
// never overlapped — the newest value waits for it and then saves once.
export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';

export interface Autosaver<T> {
  schedule(value: T): void;
  /** Saves any pending value now. Resolves when storage is up to date. */
  flush(): Promise<void>;
  dispose(): void;
}

export function createAutosaver<T>(
  save: (value: T) => Promise<void>,
  onStatus: (status: SaveStatus, error?: unknown) => void,
  delayMs = 600,
): Autosaver<T> {
  let pending: { value: T } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;

  const run = async (): Promise<void> => {
    if (timer) clearTimeout(timer);
    timer = null;
    while (running) await running;
    if (!pending) return;
    const { value } = pending;
    pending = null;
    onStatus('saving');
    running = save(value).then(
      () => onStatus(pending ? 'pending' : 'saved'),
      (err: unknown) => onStatus('error', err),
    );
    try {
      await running;
    } finally {
      running = null;
    }
  };

  return {
    schedule(value) {
      pending = { value };
      onStatus('pending');
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void run(), delayMs);
    },
    flush: run,
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
