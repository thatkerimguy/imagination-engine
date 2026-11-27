// Deterministic fake EngineRuntimeContext for engine unit tests (happy-dom). Mirrors the
// reader's runtime-context semantics: pausable timers, one-shot frames deferred while paused,
// live tier changes, abort-on-dispose. Never imported by production code.
import { DNA_ARCHETYPES, resolveVisualDna, type DnaArchetypeId } from '@kn/core/dna';
import type {
  EngineRuntimeContext,
  EngineTier,
  HapticPattern,
  StingerPatch,
} from '@kn/core/gimmicks';
import { createOrnamentLayer } from './ornaments.ts';

interface Timer {
  id: number;
  due: number;
  cb: () => void;
  every: number | null;
  /** Remaining ms captured on pause. */
  held: number | null;
}

export interface TestContext {
  ctx: EngineRuntimeContext;
  setTier(t: EngineTier, calm?: boolean): void;
  pause(): void;
  resume(): void;
  /** Advances the fake clock, firing due timers in order. */
  advance(ms: number): void;
  /** Runs `n` frames of queued raf callbacks, `stepMs` apart. */
  frames(n: number, stepMs?: number): void;
  dispose(): void;
  stingers: StingerPatch[];
  haptics: HapticPattern[];
  /** Live timers + queued frames; must be 0 after dispose. */
  pending(): number;
  /** Graphs handed out by `ctx.audio.graph()` (fake nodes; `closed` flips on reduced/dispose). */
  graphs: FakeGraph[];
  /** Pretend the audio bus is unlocked (default false: `graph()` returns null like a fresh tab). */
  setAudioUnlocked(on: boolean): void;
}

export interface FakeGraph {
  kind: 'bed' | 'oneshot';
  closed: boolean;
  context: BaseAudioContext;
  out: GainNode;
}

export function createTestContext(
  tier: EngineTier = 'high',
  archetype: DnaArchetypeId = 'noir-rain',
  calm = false,
): TestContext {
  let now = 0;
  let seq = 0;
  let paused = false;
  let current = { tier: calm ? ('reduced' as EngineTier) : tier, calm };
  const ac = new AbortController();
  const timers = new Map<number, Timer>();
  const frames = new Map<number, (t: number) => void>();
  const pauseCbs = new Set<() => void>();
  const resumeCbs = new Set<() => void>();
  const tierCbs = new Set<(t: EngineTier) => void>();
  const stingers: StingerPatch[] = [];
  const graphs: FakeGraph[] = [];
  let unlocked = false;
  const closeGraphs = (): void => {
    for (const g of graphs) g.closed = true;
  };
  const haptics: HapticPattern[] = [];
  const sub = <T>(set: Set<T>, cb: T): (() => void) => {
    if (ac.signal.aborted) return () => undefined;
    set.add(cb);
    return () => set.delete(cb);
  };
  const addTimer = (cb: () => void, ms: number, every: boolean): (() => void) => {
    if (ac.signal.aborted) return () => undefined;
    const id = ++seq;
    const gap = Math.max(0, ms);
    timers.set(id, {
      id,
      due: now + gap,
      cb,
      every: every ? Math.max(1, gap) : null,
      held: paused ? gap : null,
    });
    return () => timers.delete(id);
  };

  const ctx: EngineRuntimeContext = {
    get tier() {
      return current.tier;
    },
    get calm() {
      return current.calm;
    },
    get paused() {
      return paused;
    },
    signal: ac.signal,
    dna: resolveVisualDna(DNA_ARCHETYPES[archetype], 'dark'),
    onPause: (cb) => sub(pauseCbs, cb),
    onResume: (cb) => sub(resumeCbs, cb),
    onTierChange: (cb) => sub(tierCbs, cb),
    raf(cb) {
      if (ac.signal.aborted) return () => undefined;
      const id = ++seq;
      frames.set(id, cb);
      return () => frames.delete(id);
    },
    timeout: (cb, ms) => addTimer(cb, ms, false),
    interval: (cb, ms) => addTimer(cb, ms, true),
    audio: {
      get enabled() {
        return current.tier !== 'reduced' && !current.calm;
      },
      stinger(patch) {
        if (current.tier !== 'reduced' && !current.calm) stingers.push(patch);
      },
      graph(kind) {
        if (!unlocked || current.tier === 'reduced' || current.calm || ac.signal.aborted) return null;
        const g = fakeGraph(kind);
        graphs.push(g);
        return g;
      },
    },
    haptics(p) {
      if (current.tier !== 'reduced' && !current.calm) haptics.push(p);
    },
    surfaceTile: () => 'none',
    ornamentSvg: (g) => createOrnamentLayer(g, 1.5),
  };

  return {
    ctx,
    stingers,
    haptics,
    graphs,
    setAudioUnlocked: (on) => void (unlocked = on),
    setTier(t, c = false) {
      const next = { tier: c ? ('reduced' as EngineTier) : t, calm: c };
      if (next.tier === current.tier && next.calm === current.calm) return;
      current = next;
      if (current.tier === 'reduced') closeGraphs();
      for (const cb of [...tierCbs]) cb(current.tier);
    },
    pause() {
      if (paused) return;
      paused = true;
      for (const t of timers.values()) t.held = Math.max(0, t.due - now);
      for (const cb of [...pauseCbs]) cb();
    },
    resume() {
      if (!paused) return;
      paused = false;
      for (const t of timers.values()) {
        t.due = now + (t.held ?? 0);
        t.held = null;
      }
      for (const cb of [...resumeCbs]) cb();
    },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        if (paused) break;
        const next = [...timers.values()].sort((a, b) => a.due - b.due || a.id - b.id)[0];
        if (!next || next.due > end) break;
        now = next.due;
        if (next.every === null) timers.delete(next.id);
        else next.due = now + next.every;
        next.cb();
      }
      now = end;
    },
    frames(n, stepMs = 16) {
      for (let i = 0; i < n && !paused; i++) {
        now += stepMs;
        const batch = [...frames.entries()];
        frames.clear();
        for (const [, cb] of batch) cb(now);
      }
    },
    dispose() {
      ac.abort();
      closeGraphs();
      timers.clear();
      frames.clear();
      pauseCbs.clear();
      resumeCbs.clear();
      tierCbs.clear();
    },
    pending: () => timers.size + frames.size,
  };
}

/** Minimal recording fake of the WebAudio nodes procedural engines use (happy-dom has none). */
function fakeGraph(kind: 'bed' | 'oneshot'): FakeGraph {
  const param = (v: number): AudioParam =>
    ({
      value: v,
      setValueAtTime: () => undefined,
      linearRampToValueAtTime: () => undefined,
      exponentialRampToValueAtTime: () => undefined,
      setTargetAtTime: () => undefined,
      cancelScheduledValues: () => undefined,
    }) as unknown as AudioParam;
  const node = (): Record<string, unknown> => ({
    connect: (n: unknown) => n,
    disconnect: () => undefined,
    start: () => undefined,
    stop: () => undefined,
    onended: null,
    gain: param(1),
    frequency: param(440),
    detune: param(0),
    Q: param(1),
    playbackRate: param(1),
    pan: param(0),
    type: 'sine',
    buffer: null,
    loop: false,
  });
  const context = {
    currentTime: 0,
    sampleRate: 22050,
    state: 'running',
    destination: node(),
    createGain: node,
    createOscillator: node,
    createBiquadFilter: node,
    createBufferSource: node,
    createStereoPanner: node,
    createBuffer: (ch: number, len: number, rate: number) => ({
      numberOfChannels: ch,
      length: len,
      sampleRate: rate,
      duration: len / rate,
      getChannelData: () => new Float32Array(len),
    }),
  } as unknown as BaseAudioContext;
  return { kind, closed: false, context, out: node() as unknown as GainNode };
}
