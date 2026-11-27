// Procedural Web Audio one-shot stingers (≤ 0.35 s each), shaped by `dna.sonic.timbre`.
// Every source is scheduled to stop and disconnects itself on `ended`; the returned handle lets
// the host cut a stinger early on teardown. No samples, no downloads.
import type { SonicTimbre } from '@kn/core/dna';
import type { StingerOptions, StingerPatch } from '@kn/core/gimmicks';

export interface StingerHandle {
  stop(): void;
}

export interface AudioTarget {
  ctx: AudioContext;
  out: AudioNode;
}

interface Voice {
  wave: OscillatorType;
  /** Low-pass cutoff multiplier and release multiplier for the timbre. */
  bright: number;
  release: number;
  detune: number;
}

const TIMBRES: Record<Exclude<SonicTimbre, 'silent'>, Voice> = {
  'synth-cold': { wave: 'square', bright: 1.4, release: 0.8, detune: 0 },
  'acoustic-warm': { wave: 'triangle', bright: 0.6, release: 1, detune: 0 },
  'mechanical-click': { wave: 'square', bright: 1, release: 0.6, detune: 0 },
  ethereal: { wave: 'sine', bright: 0.9, release: 1.25, detune: 7 },
};

let shared: AudioContext | null = null;

/** Lazy singleton for hosts without their own bus. Null when Web Audio is unavailable. */
function fallbackTarget(): AudioTarget | null {
  try {
    const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
    if (!Ctor) return null;
    shared ??= new Ctor();
    return { ctx: shared, out: shared.destination };
  } catch {
    return null;
  }
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(
    1,
    Math.max(1, Math.floor(ctx.sampleRate * seconds)),
    ctx.sampleRate,
  );
  const data = buf.getChannelData(0);
  let seed = 0x2545f491;
  for (let i = 0; i < data.length; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    data[i] = ((seed >>> 0) / 4294967296) * 2 - 1;
  }
  return buf;
}

interface Part {
  kind: 'tone' | 'noise';
  freq: number;
  dur: number;
  level: number;
  /** Optional end frequency (tones) or filter type (noise). */
  to?: number;
  filter?: BiquadFilterType;
  delay?: number;
}

const PATCHES: Record<StingerPatch, Part[]> = {
  chime: [
    { kind: 'tone', freq: 880, dur: 0.32, level: 0.5 },
    { kind: 'tone', freq: 1320, dur: 0.26, level: 0.28, delay: 0.02 },
  ],
  click: [{ kind: 'noise', freq: 3200, dur: 0.025, level: 0.6, filter: 'bandpass' }],
  'seal-crack': [
    { kind: 'noise', freq: 1200, dur: 0.09, level: 0.7, filter: 'lowpass' },
    { kind: 'tone', freq: 110, to: 60, dur: 0.16, level: 0.5 },
  ],
  beep: [{ kind: 'tone', freq: 1000, dur: 0.12, level: 0.35 }],
  'type-key': [
    { kind: 'noise', freq: 2400, dur: 0.018, level: 0.55, filter: 'highpass' },
    { kind: 'tone', freq: 180, dur: 0.03, level: 0.2 },
  ],
  'paper-rustle': [{ kind: 'noise', freq: 1800, dur: 0.3, level: 0.35, filter: 'bandpass' }],
  pulse: [{ kind: 'tone', freq: 72, to: 48, dur: 0.3, level: 0.7 }],
};

/** Plays a stinger; returns null when silent, unsupported or the context is suspended. */
export function playStinger(
  patch: StingerPatch,
  timbre: SonicTimbre,
  options: StingerOptions & { dnaGain?: number } = {},
  target: AudioTarget | null = fallbackTarget(),
): StingerHandle | null {
  if (timbre === 'silent' || !target) return null;
  const { ctx, out } = target;
  if (ctx.state === 'closed') return null;
  const voice = TIMBRES[timbre];
  const pitch = 2 ** ((options.pitchShift ?? 0) / 12);
  const master = (options.gain ?? 1) * (options.dnaGain ?? 0.5) * 0.6;
  const now = ctx.currentTime + 0.005;
  const sources: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [];
  for (const p of PATCHES[patch]) {
    const t = now + (p.delay ?? 0);
    const dur = Math.min(0.35, p.dur * voice.release);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(Math.max(0.0001, p.level * master), t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    amp.connect(out);
    let src: AudioScheduledSourceNode;
    if (p.kind === 'tone') {
      const osc = ctx.createOscillator();
      osc.type = patch === 'chime' || patch === 'pulse' ? 'sine' : voice.wave;
      osc.frequency.setValueAtTime(p.freq * pitch, t);
      if (p.to) osc.frequency.exponentialRampToValueAtTime(p.to * pitch, t + dur);
      osc.detune.value = voice.detune;
      osc.connect(amp);
      src = osc;
    } else {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer(ctx, dur + 0.02);
      const f = ctx.createBiquadFilter();
      f.type = p.filter ?? 'bandpass';
      f.frequency.value = p.freq * pitch * voice.bright;
      noise.connect(f).connect(amp);
      nodes.push(f);
      src = noise;
    }
    src.start(t);
    src.stop(t + dur + 0.02);
    nodes.push(amp);
    sources.push(src);
  }
  let done = 0;
  const cleanup = (): void => {
    for (const n of [...sources, ...nodes]) n.disconnect();
  };
  for (const s of sources) s.onended = () => ++done === sources.length && cleanup();
  return {
    stop() {
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          // Already stopped.
        }
      }
      cleanup();
    },
  };
}
