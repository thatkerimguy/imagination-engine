// Leak-proof EngineRuntimeContext factory. Every frame, timer, listener and stinger an engine asks
// for is tracked and released by dispose(), so an engine cannot leak by design. Pause comes from
// the writer host (`kn:lifecycle`) and page visibility; tier changes arrive live on
// `kn:tier-change` and are pushed to engines without remounting.
import type { ResolvedVisualDna } from '@kn/core/dna';
import type {
  EngineAudioGraph,
  EngineRuntimeContext,
  EngineTier,
  HapticPattern,
} from '@kn/core/gimmicks';
import type { AudioBusAccess } from '@kn/core/renderer';
import { createOrnamentLayer, surfaceTile } from '@kn/engines/shared';
import { playStinger, type StingerHandle } from '@kn/engines/shared/stingers';
import { isAppActive, LIFECYCLE_EVENT } from './runtime/lifecycle.ts';
import { createScheduler } from './runtime/scheduler.ts';
import { DNA_EVENT, type DnaChange } from './runtime/dna-bus.ts';
import { TIER_EVENT, type TierChange } from './runtime/tier-bus.ts';

export interface RuntimeOptions {
  tier: EngineTier;
  calm: boolean;
  dna: ResolvedVisualDna;
  /** The reading root whose DNA this block follows (`kn:dna-change` events for other roots are ignored). */
  dnaRoot?: HTMLElement;
  audio: AudioBusAccess | null;
}

export interface RuntimeHandle {
  ctx: EngineRuntimeContext;
  setTier(tier: EngineTier, calm: boolean): void;
  dispose(): void;
}

const VIBES: Record<Exclude<HapticPattern, 'none'>, number[]> = {
  tap: [12],
  pulse: [18, 50, 18],
  heavy: [45],
  double: [14, 70, 14],
};

let live = 0;
/** Sandbox / smoke telemetry: tracked frames, timers and stingers across every live context. */
export const liveRuntimeResources = (): number => live;

export function createEngineRuntimeContext(opts: RuntimeOptions): RuntimeHandle {
  const ac = new AbortController();
  const { signal } = ac;
  let tier: EngineTier = opts.calm ? 'reduced' : opts.tier;
  let calm = opts.calm;
  let paused = !isAppActive() || document.visibilityState === 'hidden';
  const pauseCbs = new Set<() => void>();
  const resumeCbs = new Set<() => void>();
  const tierCbs = new Set<(t: EngineTier) => void>();
  const dnaCbs = new Set<(d: ResolvedVisualDna) => void>();
  let dna = opts.dna;
  const stingers = new Set<StingerHandle>();
  const graphs = new Set<{ out: GainNode; closed: boolean }>();
  let counted = 0;
  const recount = (): void => {
    const n = sched.size + stingers.size + graphs.size;
    live += n - counted;
    counted = n;
  };
  const run = (fn: () => void): void => {
    if (signal.aborted) return;
    try {
      fn();
    } catch (err) {
      console.warn('[engine] callback failed', err);
    }
  };
  const sched = createScheduler(paused, run, () => recount());
  const still = (): boolean => tier === 'reduced' || calm;
  const sub = <T>(set: Set<T>, cb: T): (() => void) => {
    if (signal.aborted) return () => undefined;
    set.add(cb);
    return () => void set.delete(cb);
  };
  const bus = (): AudioBusAccess | null =>
    opts.audio?.context && opts.audio.sfx && dna.sonic.timbre !== 'silent' ? opts.audio : null;

  // Host-side kill switch for procedural graphs: a 50 ms ramp to silence, then disconnect.
  const closeGraphs = (): void => {
    for (const g of graphs) {
      g.closed = true;
      try {
        const t = g.out.context.currentTime;
        g.out.gain.cancelScheduledValues(t);
        g.out.gain.setValueAtTime(g.out.gain.value, t);
        g.out.gain.linearRampToValueAtTime(0, t + 0.05);
        const out = g.out;
        globalThis.setTimeout(() => out.disconnect(), 80);
      } catch {
        g.out.disconnect();
      }
    }
    graphs.clear();
    recount();
  };

  const audio: EngineRuntimeContext['audio'] = Object.freeze({
    get enabled() {
      return !still() && !!bus();
    },
    stinger(patch: Parameters<EngineRuntimeContext['audio']['stinger']>[0], options = {}) {
      const b = bus();
      if (still() || signal.aborted || !b?.context || !b.sfx) return;
      const opt = { ...options, dnaGain: dna.sonic.gain };
      const h = playStinger(patch, dna.sonic.timbre, opt, { ctx: b.context, out: b.sfx });
      if (!h) return;
      stingers.add(h);
      recount();
      sched.timeout(() => (stingers.delete(h), recount()), 450);
    },
    graph(kind: 'bed' | 'oneshot'): EngineAudioGraph | null {
      const b = bus();
      const dest = kind === 'bed' ? (b?.ambience ?? b?.sfx) : b?.sfx;
      if (still() || signal.aborted || !b?.context || !dest) return null;
      const out = b.context.createGain();
      out.gain.value = dna.sonic.gain > 0 ? 1 : 0;
      out.connect(dest);
      const g = { out, closed: false };
      graphs.add(g);
      recount();
      return {
        context: b.context,
        out,
        get closed() {
          return g.closed;
        },
      };
    },
  });

  const ctx: EngineRuntimeContext = Object.freeze({
    get tier() {
      return tier;
    },
    get calm() {
      return calm;
    },
    get paused() {
      return paused;
    },
    signal,
    get dna() {
      return dna;
    },
    onPause: (cb: () => void) => sub(pauseCbs, cb),
    onResume: (cb: () => void) => sub(resumeCbs, cb),
    onTierChange: (cb: (t: EngineTier) => void) => sub(tierCbs, cb),
    onDnaChange: (cb: (d: ResolvedVisualDna) => void) => sub(dnaCbs, cb),
    raf: sched.raf,
    timeout: sched.timeout,
    interval: sched.interval,
    audio,
    haptics(pattern: HapticPattern) {
      if (still() || pattern === 'none' || signal.aborted) return;
      try {
        navigator.vibrate?.(VIBES[pattern]);
      } catch {
        // Unsupported or blocked: haptics are a nicety.
      }
    },
    surfaceTile: (material: Parameters<EngineRuntimeContext['surfaceTile']>[0]) =>
      surfaceTile(material, dna.theme, dna.surface.grainIntensity),
    ornamentSvg: (grammar: Parameters<EngineRuntimeContext['ornamentSvg']>[0]) =>
      createOrnamentLayer(grammar, Number.parseFloat(dna.tokens['--dna-stroke'] ?? '1.5')),
  });

  const setPaused = (next: boolean): void => {
    if (next === paused || signal.aborted) return;
    paused = next;
    sched.setPaused(next);
    for (const cb of [...(next ? pauseCbs : resumeCbs)]) run(cb);
  };
  const setTier = (next: EngineTier, nextCalm: boolean): void => {
    const t: EngineTier = nextCalm ? 'reduced' : next;
    if (signal.aborted || (t === tier && nextCalm === calm)) return;
    tier = t;
    calm = nextCalm;
    if (still()) {
      for (const h of stingers) h.stop();
      closeGraphs();
    }
    for (const cb of [...tierCbs]) run(() => cb(tier));
  };

  const on = { signal };
  addEventListener(
    TIER_EVENT,
    (e) => {
      const d = (e as CustomEvent<TierChange>).detail;
      setTier(d.tier, d.calm);
    },
    on,
  );
  addEventListener(
    DNA_EVENT,
    (e) => {
      const d = (e as CustomEvent<DnaChange>).detail;
      if ((opts.dnaRoot && d.root !== opts.dnaRoot) || d.dna === dna) return;
      dna = d.dna;
      for (const cb of [...dnaCbs]) run(() => cb(dna));
    },
    on,
  );
  addEventListener(
    LIFECYCLE_EVENT,
    (e) => {
      setPaused(!(e as CustomEvent<{ active: boolean }>).detail.active);
    },
    on,
  );
  document.addEventListener(
    'visibilitychange',
    () => {
      setPaused(document.visibilityState === 'hidden' || !isAppActive());
    },
    on,
  );

  return {
    ctx,
    setTier,
    dispose() {
      if (signal.aborted) return;
      ac.abort();
      sched.clear();
      for (const h of stingers) h.stop();
      stingers.clear();
      closeGraphs();
      pauseCbs.clear();
      resumeCbs.clear();
      tierCbs.clear();
      dnaCbs.clear();
      recount();
    },
  };
}
