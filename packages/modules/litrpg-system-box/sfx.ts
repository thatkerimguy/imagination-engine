// A short, quiet synthesized chime (two sine partials) through the shared SFX bus.
import type { AudioBusAccess } from '@kn/core/renderer';

/** Plays the chime and returns a canceller that stops and disconnects everything. */
export function playChime(audio: AudioBusAccess | null): () => void {
  const ctx = audio?.context;
  const out = audio?.sfx;
  if (!ctx || !out) return () => undefined;
  const bus = ctx.createGain();
  bus.gain.value = 0.12;
  bus.connect(out);
  const t0 = ctx.currentTime + 0.02;
  const oscs: OscillatorNode[] = [];
  for (const [hz, level, decay] of [
    [880, 0.6, 0.45],
    [1320, 0.35, 0.3],
  ] as const) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = hz;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(level, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    o.connect(g).connect(bus);
    o.start(t0);
    o.stop(t0 + decay + 0.02);
    oscs.push(o);
  }
  const done = setTimeout(() => bus.disconnect(), 700);
  return () => {
    clearTimeout(done);
    for (const o of oscs) {
      try {
        o.stop();
      } catch {
        // Already stopped.
      }
    }
    bus.disconnect();
  };
}
