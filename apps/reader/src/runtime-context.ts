// Leak-proof EngineRuntimeContext factory. Every frame, timer, listener and stinger an engine asks
// for is tracked and released by dispose(), so an engine cannot leak by design. Pause comes from
// the writer host (`kn:lifecycle`) and page visibility; tier changes arrive live on
// `kn:tier-change` and are pushed to engines without remounting.
import type { ResolvedVisualDna } from '@kn/core/dna';
import type { EngineRuntimeContext, EngineTier, HapticPattern } from '@kn/core/gimmicks';
import type { AudioBusAccess } from '@kn/core/renderer';
import { createOrnamentLayer, surfaceTile } from '@kn/engines/shared';
import { playStinger, type StingerHandle } from '@kn/engines/shared/stingers';
import { isAppActive, LIFECYCLE_EVENT } from './runtime/lifecycle.ts';
import { createScheduler } from './runtime/scheduler.ts';
import { TIER_EVENT, type TierChange } from './runtime/tier-bus.ts';

export interface RuntimeOptions {
  tier: EngineTier;
  calm: boolean;
  dna: ResolvedVisualDna;
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
  const stingers = new Set<StingerHandle>();
  let counted = 0;
  const recount = (): void => {
    const n = sched.size + stingers.size;
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
    opts.audio?.context && opts.audio.sfx && opts.dna.sonic.timbre !== 'silent' ? opts.audio : null;

  const audio: EngineRuntimeContext['audio'] = Object.freeze({
    get enabled() {
      return !still() && !!bus();
    },
    stinger(patch: Parameters<EngineRuntimeContext['audio']['stinger']>[0], options = {}) {
      const b = bus();
      if (still() || signal.aborted || !b?.context || !b.sfx) return;
      const opt = { ...options, dnaGain: opts.dna.sonic.gain };
      const h = playStinger(patch, opts.dna.sonic.timbre, opt, { ctx: b.context, out: b.sfx });
      if (!h) return;
      stingers.add(h);
      recount();
      sched.timeout(() => (stingers.delete(h), recount()), 450);
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
    dna: opts.dna,
    onPause: (cb: () => void) => sub(pauseCbs, cb),
    onResume: (cb: () => void) => sub(resumeCbs, cb),
    onTierChange: (cb: (t: EngineTier) => void) => sub(tierCbs, cb),
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
      surfaceTile(material, opts.dna.theme, opts.dna.surface.grainIntensity),
    ornamentSvg: (grammar: Parameters<EngineRuntimeContext['ornamentSvg']>[0]) =>
      createOrnamentLayer(grammar, Number.parseFloat(opts.dna.tokens['--dna-stroke'] ?? '1.5')),
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
    if (still()) for (const h of stingers) h.stop();
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
      pauseCbs.clear();
      resumeCbs.clear();
      tierCbs.clear();
      recount();
    },
  };
}
