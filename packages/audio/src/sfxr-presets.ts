import type { SfxrParams } from '@ie/story';
import { generateScene, SCENE_PRESETS, type ScenePreset } from './sfxr-scene.ts';
import { SFXR_DEFAULTS } from './sfxr.ts';

/** sfxr's classic generators, then story sounds; each makes a random sound of its kind. */
export const SFXR_PRESETS = [
  'pickup',
  'laser',
  'explosion',
  'powerup',
  'hit',
  'jump',
  'blip',
  ...SCENE_PRESETS,
  'random',
] as const;
export type SfxrPreset = (typeof SFXR_PRESETS)[number];

type Mutable = { -readonly [K in keyof SfxrParams]: SfxrParams[K] };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A random sound of the given kind, after the original sfxr generators. */
export function generateSfxr(kind: SfxrPreset, random: () => number = Math.random): SfxrParams {
  const f = (range: number) => random() * range;
  const pick = (n: number) => Math.floor(random() * (n + 1));
  if ((SCENE_PRESETS as readonly string[]).includes(kind))
    return generateScene(kind as ScenePreset, random);
  const p: Mutable = { ...SFXR_DEFAULTS };
  switch (kind) {
    case 'pickup':
      p.freq = 0.4 + f(0.5);
      p.attack = 0;
      p.sustain = f(0.1);
      p.decay = 0.1 + f(0.4);
      p.punch = 0.3 + f(0.3);
      if (pick(1)) {
        p.arpSpeed = 0.5 + f(0.2);
        p.arpMod = 0.2 + f(0.4);
      }
      break;
    case 'laser': {
      p.wave = (['square', 'saw', 'sine'] as const)[pick(2)] ?? 'square';
      if (p.wave === 'sine' && pick(1)) p.wave = pick(1) ? 'saw' : 'square';
      p.freq = 0.5 + f(0.5);
      p.freqLimit = Math.max(0.2, p.freq - 0.2 - f(0.6));
      p.freqRamp = -0.15 - f(0.2);
      if (pick(2) === 0) {
        p.freq = 0.3 + f(0.6);
        p.freqLimit = f(0.1);
        p.freqRamp = -0.35 - f(0.3);
      }
      if (pick(1)) {
        p.duty = f(0.5);
        p.dutyRamp = f(0.2);
      } else {
        p.duty = 0.4 + f(0.5);
        p.dutyRamp = -f(0.7);
      }
      p.sustain = 0.1 + f(0.2);
      p.decay = f(0.4);
      if (pick(1)) p.punch = f(0.3);
      if (pick(2) === 0) {
        p.phaserOffset = f(0.2);
        p.phaserRamp = -f(0.2);
      }
      if (pick(1)) p.hpf = f(0.3);
      break;
    }
    case 'explosion':
      p.wave = 'noise';
      if (pick(1)) {
        p.freq = 0.1 + f(0.4);
        p.freqRamp = -0.1 + f(0.4);
      } else {
        p.freq = 0.2 + f(0.7);
        p.freqRamp = -0.2 - f(0.2);
      }
      p.freq *= p.freq;
      if (pick(4) === 0) p.freqRamp = 0;
      if (pick(2) === 0) p.repeatSpeed = 0.3 + f(0.5);
      p.sustain = 0.1 + f(0.3);
      p.decay = f(0.5);
      if (pick(1) === 0) {
        p.phaserOffset = -0.3 + f(0.9);
        p.phaserRamp = -f(0.3);
      }
      p.punch = 0.2 + f(0.6);
      if (pick(1)) {
        p.vibratoDepth = f(0.7);
        p.vibratoSpeed = f(0.6);
      }
      if (pick(2) === 0) {
        p.arpSpeed = 0.6 + f(0.3);
        p.arpMod = 0.8 - f(1.6);
      }
      break;
    case 'powerup':
      if (pick(1)) p.wave = 'saw';
      else p.duty = f(0.6);
      p.freq = 0.2 + f(0.3);
      if (pick(1)) {
        p.freqRamp = 0.1 + f(0.4);
        p.repeatSpeed = 0.4 + f(0.4);
      } else {
        p.freqRamp = 0.05 + f(0.2);
        if (pick(1)) {
          p.vibratoDepth = f(0.7);
          p.vibratoSpeed = f(0.6);
        }
      }
      p.sustain = f(0.4);
      p.decay = 0.1 + f(0.4);
      break;
    case 'hit':
      p.wave = (['square', 'saw', 'noise'] as const)[pick(2)] ?? 'square';
      if (p.wave === 'square') p.duty = f(0.6);
      p.freq = 0.2 + f(0.6);
      p.freqRamp = -0.3 - f(0.4);
      p.sustain = f(0.1);
      p.decay = 0.1 + f(0.2);
      if (pick(1)) p.hpf = f(0.3);
      break;
    case 'jump':
      p.duty = f(0.6);
      p.freq = 0.3 + f(0.3);
      p.freqRamp = 0.1 + f(0.2);
      p.sustain = 0.1 + f(0.3);
      p.decay = 0.1 + f(0.2);
      if (pick(1)) p.hpf = f(0.3);
      if (pick(1)) p.lpf = 1 - f(0.6);
      break;
    case 'blip':
      p.wave = pick(1) ? 'saw' : 'square';
      if (p.wave === 'square') p.duty = f(0.6);
      p.freq = 0.2 + f(0.4);
      p.sustain = 0.1 + f(0.1);
      p.decay = f(0.2);
      p.hpf = 0.1;
      break;
    case 'random':
      return mutateSfxr(
        {
          ...SFXR_DEFAULTS,
          wave: (['square', 'saw', 'sine', 'noise'] as const)[pick(3)] ?? 'square',
        },
        random,
        1,
      );
    default:
      break;
  }
  return p;
}

const SIGNED: readonly (keyof SfxrParams)[] = [
  'freqRamp',
  'freqDeltaRamp',
  'arpMod',
  'dutyRamp',
  'phaserOffset',
  'phaserRamp',
  'lpfRamp',
  'hpfRamp',
];

/** Nudges every number a little (`amount` 0..1), like sfxr's Mutate button. */
export function mutateSfxr(
  params: SfxrParams,
  random: () => number = Math.random,
  amount = 0.1,
): SfxrParams {
  const out: Record<string, unknown> = { ...params };
  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== 'number' || key === 'volume') continue;
    if (amount < 1 && random() < 0.5) continue;
    const lo = SIGNED.includes(key as keyof SfxrParams) ? -1 : 0;
    const next = amount >= 1 ? lo + random() * (1 - lo) : value + (random() * 2 - 1) * amount;
    out[key] = Math.round(clamp(next, lo, 1) * 1000) / 1000;
  }
  const p = out as unknown as Mutable;
  // A fully random sound must stay audible: some sustain and decay, and not a subsonic pitch.
  if (amount >= 1) {
    p.attack = p.attack ** 3;
    p.sustain = 0.1 + p.sustain * 0.4;
    p.decay = 0.1 + p.decay * 0.5;
    p.freq = 0.15 + p.freq * 0.7;
    p.freqLimit = 0;
    p.lpf = 0.5 + p.lpf * 0.5;
    p.hpf = p.hpf * 0.3;
  }
  return p;
}
