// Pausable, tracked frame + timer scheduler behind EngineRuntimeContext. Every handle lives in
// a Map until it fires or is cancelled, so `clear()` provably releases everything.

interface Timer {
  cb: () => void;
  every: number | null;
  due: number;
  held: number | null;
  handle: number;
}

export interface Scheduler {
  raf(cb: (t: number) => void): () => void;
  timeout(cb: () => void, ms: number): () => void;
  interval(cb: () => void, ms: number): () => void;
  setPaused(paused: boolean): void;
  readonly size: number;
  clear(): void;
}

/** `run` wraps every callback (abort guard + try/catch); `changed` fires when `size` moves. */
export function createScheduler(
  paused: boolean,
  run: (fn: () => void) => void,
  changed: () => void,
): Scheduler {
  let seq = 0;
  let cleared = false;
  const rafs = new Map<number, (t: number) => void>();
  const rafHandles = new Map<number, number>();
  const timers = new Map<number, Timer>();

  const requestFrame = (id: number): void => {
    rafHandles.set(
      id,
      requestAnimationFrame((t) => {
        rafHandles.delete(id);
        const cb = rafs.get(id);
        rafs.delete(id);
        changed();
        if (cb) run(() => cb(t));
      }),
    );
  };
  const arm = (id: number, t: Timer, ms: number): void => {
    t.due = performance.now() + ms;
    t.handle = window.setTimeout(() => {
      if (t.every === null) timers.delete(id);
      else arm(id, t, t.every);
      changed();
      run(t.cb);
    }, ms);
  };
  const addTimer = (cb: () => void, ms: number, every: boolean): (() => void) => {
    if (cleared) return () => undefined;
    const id = ++seq;
    const gap = Math.max(0, ms);
    const t: Timer = { cb, every: every ? Math.max(16, gap) : null, due: 0, held: null, handle: 0 };
    timers.set(id, t);
    if (paused) t.held = gap;
    else arm(id, t, gap);
    changed();
    return () => {
      clearTimeout(t.handle);
      if (timers.delete(id)) changed();
    };
  };

  return {
    raf(cb) {
      if (cleared) return () => undefined;
      const id = ++seq;
      rafs.set(id, cb);
      if (!paused) requestFrame(id);
      changed();
      return () => {
        const h = rafHandles.get(id);
        if (h !== undefined) cancelAnimationFrame(h);
        rafHandles.delete(id);
        if (rafs.delete(id)) changed();
      };
    },
    timeout: (cb, ms) => addTimer(cb, ms, false),
    interval: (cb, ms) => addTimer(cb, ms, true),
    setPaused(next) {
      if (next === paused || cleared) return;
      paused = next;
      if (paused) {
        for (const h of rafHandles.values()) cancelAnimationFrame(h);
        rafHandles.clear();
        for (const t of timers.values()) {
          clearTimeout(t.handle);
          t.held = Math.max(0, t.due - performance.now());
        }
      } else {
        for (const [id, t] of timers) arm(id, t, t.held ?? 0);
        for (const id of rafs.keys()) requestFrame(id);
      }
    },
    get size() {
      return rafs.size + timers.size;
    },
    clear() {
      cleared = true;
      for (const h of rafHandles.values()) cancelAnimationFrame(h);
      for (const t of timers.values()) clearTimeout(t.handle);
      rafs.clear();
      rafHandles.clear();
      timers.clear();
      changed();
    },
  };
}
