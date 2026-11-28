// bespoke-3d sound: dice clatter scheduled from the pre-simulation's recorded impacts, plus the
// lighter's lid clack and ignition whoosh. All procedural, on a host-tracked
// `ctx.audio.graph('oneshot')` output, so Calm Mode / reduced / unmount silence it instantly.
import type { EngineRuntimeContext } from '@kn/core/gimmicks';
import type { DiceMaterial } from './dice/palette.ts';
import type { Impact } from './dice/simulate.ts';

const TONE: Record<DiceMaterial, { click: number; ring: number; ringLevel: number }> = {
  ivory: { click: 3200, ring: 0, ringLevel: 0 },
  'casino-red': { click: 2600, ring: 0, ringLevel: 0 },
  brass: { click: 4200, ring: 3100, ringLevel: 0.25 },
  obsidian: { click: 3600, ring: 5200, ringLevel: 0.08 },
};

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
function noise(ac: BaseAudioContext): AudioBuffer {
  let b = noiseCache.get(ac);
  if (!b) {
    b = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.4), ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ac, b);
  }
  return b;
}

type Stop = () => void;

function voice(ctx: EngineRuntimeContext): {
  ac: BaseAudioContext;
  out: AudioNode;
  stop: Stop;
  add(n: AudioScheduledSourceNode): void;
} | null {
  const g = ctx.audio.graph('oneshot');
  if (!g) return null;
  const nodes: AudioScheduledSourceNode[] = [];
  return {
    ac: g.context,
    out: g.out,
    add: (n) => void nodes.push(n),
    stop: () => {
      for (const n of nodes) {
        try {
          n.stop();
        } catch {
          // Already stopped.
        }
      }
      g.out.disconnect();
    },
  };
}

function burst(
  ac: BaseAudioContext,
  out: AudioNode,
  at: number,
  freq: number,
  level: number,
  len: number,
  type: BiquadFilterType = 'bandpass',
): AudioBufferSourceNode {
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = 2.5;
  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), at + 0.003);
  env.gain.exponentialRampToValueAtTime(0.0001, at + len);
  src.connect(f).connect(env).connect(out);
  src.start(at, Math.random() * 0.1, len + 0.02);
  return src;
}

/** Schedules every recorded impact; returns a canceller (also safe after the host closed it). */
export function scheduleClatter(
  ctx: EngineRuntimeContext,
  impacts: readonly Impact[],
  material: DiceMaterial,
): Stop {
  const v = voice(ctx);
  if (!v) return () => undefined;
  const tone = TONE[material];
  const t0 = v.ac.currentTime + 0.03;
  for (const hit of impacts) {
    const at = t0 + hit.time;
    const level = 0.12 + 0.5 * hit.strength * hit.strength;
    v.add(burst(v.ac, v.out, at, tone.click * (0.85 + Math.random() * 0.3), level, 0.06));
    const thock = v.ac.createOscillator();
    thock.frequency.setValueAtTime(190, at);
    thock.frequency.exponentialRampToValueAtTime(90, at + 0.07);
    const env = v.ac.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(level * 0.6, at + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
    thock.connect(env).connect(v.out);
    thock.start(at);
    thock.stop(at + 0.1);
    v.add(thock);
    if (tone.ringLevel > 0) {
      const ring = v.ac.createOscillator();
      ring.frequency.value = tone.ring * (0.97 + Math.random() * 0.06);
      const renv = v.ac.createGain();
      renv.gain.setValueAtTime(0.0001, at);
      renv.gain.exponentialRampToValueAtTime(level * tone.ringLevel, at + 0.004);
      renv.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
      ring.connect(renv).connect(v.out);
      ring.start(at);
      ring.stop(at + 0.4);
      v.add(ring);
    }
  }
  return v.stop;
}

/** Brass lid clack (open or shut). */
export function playClack(ctx: EngineRuntimeContext, shut = false): Stop {
  const v = voice(ctx);
  if (!v) return () => undefined;
  const at = v.ac.currentTime + 0.01;
  v.add(burst(v.ac, v.out, at, shut ? 1800 : 2600, 0.5, 0.05));
  v.add(burst(v.ac, v.out, at + 0.035, shut ? 900 : 3400, 0.22, 0.04));
  return v.stop;
}

/** Flint rasp + soft ignition whoosh (≤ 0.5 s). */
export function playIgnite(ctx: EngineRuntimeContext): Stop {
  const v = voice(ctx);
  if (!v) return () => undefined;
  const at = v.ac.currentTime + 0.01;
  v.add(burst(v.ac, v.out, at, 5200, 0.25, 0.09, 'highpass'));
  v.add(burst(v.ac, v.out, at + 0.08, 700, 0.35, 0.4, 'lowpass'));
  return v.stop;
}
