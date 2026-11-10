import type { Ambience } from '@ie/story';

/*
 * Procedural ambience: each kind is a few seconds of shaped noise rendered once into a seamless
 * loop. Playing it costs one buffer source, so it adds nothing per frame.
 */

export const AMBIENCE_RATE = 22050;
const SECONDS = 8;
const CROSSFADE = 0.5;

/** One-pole low-pass, in place. `cutoff` in Hz. */
function lowpass(x: Float32Array, cutoff: number, rate: number): void {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / rate);
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    y += a * ((x[i] ?? 0) - y);
    x[i] = y;
  }
}

/** One-pole high-pass, in place. */
function highpass(x: Float32Array, cutoff: number, rate: number): void {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / rate);
  let low = 0;
  for (let i = 0; i < x.length; i++) {
    low += a * ((x[i] ?? 0) - low);
    x[i] = (x[i] ?? 0) - low;
  }
}

function white(n: number, random: () => number): Float32Array {
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = random() * 2 - 1;
  return x;
}

/** Brown noise: integrated white noise, with a leak so it doesn't wander off. */
function brown(n: number, random: () => number): Float32Array {
  const x = new Float32Array(n);
  let v = 0;
  for (let i = 0; i < n; i++) {
    v = (v + 0.02 * (random() * 2 - 1)) * 0.998;
    x[i] = v * 3.5;
  }
  return x;
}

/** Slow random swell between `lo` and `hi`, `rate` changes per second. */
function swell(
  n: number,
  rate: number,
  lo: number,
  hi: number,
  random: () => number,
): Float32Array {
  const out = new Float32Array(n);
  const step = Math.max(1, Math.round(AMBIENCE_RATE / rate));
  let from = lo + random() * (hi - lo);
  let to = lo + random() * (hi - lo);
  for (let i = 0; i < n; i++) {
    if (i % step === 0) {
      from = to;
      to = lo + random() * (hi - lo);
    }
    const f = (i % step) / step;
    out[i] = from + (to - from) * (0.5 - 0.5 * Math.cos(Math.PI * f));
  }
  return out;
}

/** Short decaying noise bursts at random times: raindrops, crackles. */
function bursts(
  out: Float32Array,
  perSecond: number,
  length: number,
  gain: number,
  random: () => number,
): void {
  const count = Math.round((perSecond * out.length) / AMBIENCE_RATE);
  const n = Math.round(length * AMBIENCE_RATE);
  for (let k = 0; k < count; k++) {
    const at = Math.floor(random() * out.length);
    const g = gain * (0.3 + random() * 0.7);
    for (let i = 0; i < n; i++) {
      const j = (at + i) % out.length;
      out[j] = (out[j] ?? 0) + g * (random() * 2 - 1) * Math.exp((-8 * i) / n);
    }
  }
}

function multiply(x: Float32Array, y: Float32Array): void {
  for (let i = 0; i < x.length; i++) x[i] = (x[i] ?? 0) * (y[i] ?? 0);
}

/** Blends the tail into the head so the buffer loops without a click, then trims the tail. */
function makeLoop(x: Float32Array): Float32Array {
  const fade = Math.round(CROSSFADE * AMBIENCE_RATE);
  const length = x.length - fade;
  const out = x.slice(0, length);
  for (let i = 0; i < fade; i++) {
    const f = i / fade;
    out[i] = (x[i] ?? 0) * Math.sqrt(f) + (x[length + i] ?? 0) * Math.sqrt(1 - f);
  }
  return out;
}

function normalize(x: Float32Array, peak: number): Float32Array {
  const max = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  for (let i = 0; i < x.length; i++) x[i] = ((x[i] ?? 0) / max) * peak;
  return x;
}

/** Renders a seamless loop of the given ambience at `AMBIENCE_RATE`. */
export function renderAmbience(kind: Ambience, random: () => number = Math.random): Float32Array {
  const n = Math.round((SECONDS + CROSSFADE) * AMBIENCE_RATE);
  const rate = AMBIENCE_RATE;
  let x: Float32Array;
  switch (kind) {
    case 'rain': {
      x = white(n, random);
      highpass(x, 500, rate);
      lowpass(x, 6000, rate);
      multiply(x, swell(n, 0.5, 0.6, 1, random));
      bursts(x, 30, 0.015, 1.5, random);
      break;
    }
    case 'wind': {
      x = brown(n, random);
      highpass(x, 80, rate);
      lowpass(x, 900, rate);
      multiply(x, swell(n, 0.3, 0.2, 1, random));
      break;
    }
    case 'room': {
      x = brown(n, random);
      lowpass(x, 180, rate);
      normalize(x, 0.3);
      return makeLoop(x);
    }
    case 'crowd': {
      x = new Float32Array(n);
      // Several murmuring "voices": band-limited noise with their own syllable-rate swells.
      for (let v = 0; v < 6; v++) {
        const voice = white(n, random);
        highpass(voice, 250 + random() * 200, rate);
        lowpass(voice, 1200 + random() * 1500, rate);
        multiply(voice, swell(n, 3 + random() * 3, 0, 1, random));
        for (let i = 0; i < n; i++) x[i] = (x[i] ?? 0) + (voice[i] ?? 0);
      }
      break;
    }
    case 'fire': {
      x = brown(n, random);
      lowpass(x, 400, rate);
      multiply(x, swell(n, 1.5, 0.5, 1, random));
      const crackle = new Float32Array(n);
      bursts(crackle, 12, 0.006, 1, random);
      highpass(crackle, 1500, rate);
      for (let i = 0; i < n; i++) x[i] = (x[i] ?? 0) + 2.5 * (crackle[i] ?? 0);
      break;
    }
  }
  return makeLoop(normalize(x, 0.5));
}
