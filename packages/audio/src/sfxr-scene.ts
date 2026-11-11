import type { SfxrParams } from '@ie/story';
import { SFXR_DEFAULTS } from './sfxr.ts';

/** Story sounds beyond sfxr's arcade set: doors, steps, a heartbeat, thunder. */
export const SCENE_PRESETS = [
  'coin',
  'click',
  'door',
  'footstep',
  'heartbeat',
  'alarm',
  'magic',
  'thunder',
  'splash',
  'whoosh',
] as const;
export type ScenePreset = (typeof SCENE_PRESETS)[number];

type Mutable = { -readonly [K in keyof SfxrParams]: SfxrParams[K] };

/** A random variation of a story sound; each call sounds a little different. */
export function generateScene(kind: ScenePreset, random: () => number): SfxrParams {
  const f = (range: number) => random() * range;
  const p: Mutable = { ...SFXR_DEFAULTS };
  switch (kind) {
    case 'coin':
      p.wave = 'square';
      p.duty = 0.4 + f(0.2);
      p.freq = 0.6 + f(0.15);
      p.sustain = 0.05 + f(0.05);
      p.decay = 0.3 + f(0.15);
      p.punch = 0.45 + f(0.2);
      p.arpSpeed = 0.55 + f(0.1);
      p.arpMod = 0.35 + f(0.15);
      break;
    case 'click':
      p.wave = 'square';
      p.duty = 0.5;
      p.freq = 0.55 + f(0.2);
      p.sustain = 0.01;
      p.decay = 0.06 + f(0.04);
      p.hpf = 0.25 + f(0.1);
      p.volume = 0.4;
      break;
    case 'door':
      // A low knock of filtered noise with a slow drop in pitch.
      p.wave = 'noise';
      p.freq = 0.1 + f(0.06);
      p.freqRamp = -0.05 - f(0.05);
      p.sustain = 0.08 + f(0.05);
      p.decay = 0.3 + f(0.15);
      p.punch = 0.5 + f(0.3);
      p.lpf = 0.25 + f(0.15);
      p.repeatSpeed = f(1) < 0.5 ? 0 : 0.55 + f(0.15);
      break;
    case 'footstep':
      p.wave = 'noise';
      p.freq = 0.18 + f(0.1);
      p.sustain = 0.02 + f(0.02);
      p.decay = 0.12 + f(0.08);
      p.punch = 0.3 + f(0.2);
      p.lpf = 0.35 + f(0.2);
      p.hpf = 0.05;
      p.volume = 0.45;
      break;
    case 'heartbeat':
      // Two soft thumps: a low sine that repeats once while it fades.
      p.wave = 'sine';
      p.freq = 0.08 + f(0.03);
      p.freqRamp = -0.12 - f(0.05);
      p.sustain = 0.05;
      p.decay = 0.45 + f(0.1);
      p.punch = 0.8;
      p.repeatSpeed = 0.62 + f(0.05);
      p.lpf = 0.4;
      break;
    case 'alarm':
      p.wave = 'square';
      p.duty = 0.3 + f(0.2);
      p.freq = 0.45 + f(0.1);
      p.sustain = 0.5 + f(0.15);
      p.decay = 0.2;
      p.vibratoDepth = 0.5 + f(0.2);
      p.vibratoSpeed = 0.35 + f(0.1);
      p.lpf = 0.75;
      break;
    case 'magic':
      p.wave = 'sine';
      p.freq = 0.35 + f(0.15);
      p.freqRamp = 0.12 + f(0.1);
      p.sustain = 0.2 + f(0.15);
      p.decay = 0.4 + f(0.2);
      p.arpSpeed = 0.4 + f(0.2);
      p.arpMod = 0.3 + f(0.3);
      p.phaserOffset = 0.15 + f(0.15);
      p.phaserRamp = 0.05 + f(0.1);
      p.vibratoDepth = 0.15 + f(0.15);
      p.vibratoSpeed = 0.6;
      break;
    case 'thunder':
      p.wave = 'noise';
      p.freq = 0.05 + f(0.05);
      p.freqRamp = -0.02 - f(0.03);
      p.attack = 0.05 + f(0.1);
      p.sustain = 0.55 + f(0.2);
      p.decay = 0.75 + f(0.2);
      p.punch = 0.6 + f(0.3);
      p.lpf = 0.3 + f(0.15);
      p.lpfRamp = -0.05;
      p.volume = 0.6;
      break;
    case 'splash':
      p.wave = 'noise';
      p.freq = 0.45 + f(0.2);
      p.freqRamp = -0.15 - f(0.1);
      p.sustain = 0.1 + f(0.1);
      p.decay = 0.35 + f(0.2);
      p.punch = 0.4;
      p.lpf = 0.6 + f(0.2);
      p.lpfRamp = -0.15;
      break;
    case 'whoosh':
      p.wave = 'noise';
      p.freq = 0.25 + f(0.15);
      p.freqRamp = 0.1 + f(0.1);
      p.attack = 0.25 + f(0.15);
      p.sustain = 0.1 + f(0.1);
      p.decay = 0.3 + f(0.15);
      p.lpf = 0.3 + f(0.2);
      p.lpfRamp = 0.2 + f(0.1);
      p.hpf = 0.1;
      break;
  }
  return p;
}
