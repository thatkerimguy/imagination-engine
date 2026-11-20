// Synthesised clatter, scheduled up-front from the pre-simulation's recorded impacts so every
// click lines up with a visible bounce. Shared by the high and lite tiers.
import type { AudioBusAccess } from '@kn/core/renderer';
import type { Impact } from './simulate.ts';
import type { DiceMaterial } from './schema.ts';

const TONE: Record<DiceMaterial, { click: number; ring: number; ringLevel: number }> = {
  ivory: { click: 3200, ring: 0, ringLevel: 0 },
  'casino-red': { click: 2600, ring: 0, ringLevel: 0 },
  brass: { click: 4200, ring: 3100, ringLevel: 0.25 },
  obsidian: { click: 3600, ring: 5200, ringLevel: 0.08 },
};

let noise: { ctx: AudioContext; buffer: AudioBuffer } | null = null;

function noiseFor(ctx: AudioContext): AudioBuffer {
  if (noise?.ctx !== ctx) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noise = { ctx, buffer };
  }
  return noise.buffer;
}

/** Schedules every impact relative to `delay` seconds from now. Returns a canceller. */
export function scheduleClatter(
  audio: AudioBusAccess,
  impacts: readonly Impact[],
  material: DiceMaterial,
  delay = 0,
): () => void {
  const ctx = audio.context;
  const out = audio.sfx;
  if (!ctx || !out) return () => undefined;
  const tone = TONE[material];
  const bus = ctx.createGain();
  bus.connect(out);
  const sources: AudioScheduledSourceNode[] = [];
  const t0 = ctx.currentTime + 0.03 + delay;
  audio.duck(0.35, impacts.at(-1)?.time ?? 1.5);
  for (const hit of impacts) {
    const at = t0 + hit.time;
    const level = 0.12 + 0.5 * hit.strength * hit.strength;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-0.8, Math.min(0.8, hit.x * 0.7));
    pan.connect(bus);
    // Click: a band-passed noise transient.
    const src = ctx.createBufferSource();
    src.buffer = noiseFor(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = tone.click * (0.85 + Math.random() * 0.3);
    bp.Q.value = 2.5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(level, at + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    src.connect(bp).connect(env).connect(pan);
    src.start(at, Math.random() * 0.1, 0.08);
    sources.push(src);
    // Body: a short low thock from the table.
    const thock = ctx.createOscillator();
    thock.frequency.setValueAtTime(190, at);
    thock.frequency.exponentialRampToValueAtTime(90, at + 0.07);
    const tenv = ctx.createGain();
    tenv.gain.setValueAtTime(0.0001, at);
    tenv.gain.exponentialRampToValueAtTime(level * 0.6, at + 0.003);
    tenv.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
    thock.connect(tenv).connect(pan);
    thock.start(at);
    thock.stop(at + 0.1);
    sources.push(thock);
    if (tone.ringLevel > 0) {
      const ring = ctx.createOscillator();
      ring.frequency.value = tone.ring * (0.97 + Math.random() * 0.06);
      const renv = ctx.createGain();
      renv.gain.setValueAtTime(0.0001, at);
      renv.gain.exponentialRampToValueAtTime(level * tone.ringLevel, at + 0.004);
      renv.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
      ring.connect(renv).connect(pan);
      ring.start(at);
      ring.stop(at + 0.4);
      sources.push(ring);
    }
  }
  const end = (impacts.at(-1)?.time ?? 0) + delay + 1;
  const cleanup = window.setTimeout(() => bus.disconnect(), end * 1000);
  return () => {
    clearTimeout(cleanup);
    for (const s of sources) {
      try {
        s.stop();
      } catch {
        // Already stopped.
      }
    }
    bus.disconnect();
  };
}
