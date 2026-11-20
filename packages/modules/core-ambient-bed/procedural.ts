// Procedural ambiences, so the demo ships zero third-party recordings. Everything is noise
// buffers, filters and a few oscillators: cheap enough for low-end phones.
import type { AmbientSource } from '@kn/core/renderer';

type Builder = (ctx: AudioContext, out: AudioNode) => AmbientSource;

function noiseBuffer(ctx: AudioContext, seconds: number, brown: boolean): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else data[i] = white;
  }
  return buffer;
}

function loop(ctx: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  // Random start offset so two beds built from the same noise never phase-lock.
  src.start(ctx.currentTime, Math.random() * buffer.duration);
  return src;
}

function filter(
  ctx: AudioContext,
  type: BiquadFilterType,
  freq: number,
  q = 0.7,
): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function gain(ctx: AudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

/** Schedules sparse one-shot events on a lookahead timer; returns a canceller. */
function sprinkle(ctx: AudioContext, minGap: number, maxGap: number, play: (at: number) => void) {
  let next = ctx.currentTime + minGap;
  const timer = setInterval(() => {
    while (next < ctx.currentTime + 0.3) {
      play(next);
      next += minGap + Math.random() * (maxGap - minGap);
    }
  }, 100);
  return () => clearInterval(timer);
}

const rain: Builder = (ctx, out) => {
  const white = noiseBuffer(ctx, 3, false);
  const hiss = loop(ctx, white);
  hiss
    .connect(filter(ctx, 'highpass', 500))
    .connect(filter(ctx, 'lowpass', 7000))
    .connect(gain(ctx, 0.22))
    .connect(out);
  const body = loop(ctx, noiseBuffer(ctx, 3, true));
  body
    .connect(filter(ctx, 'lowpass', 800))
    .connect(gain(ctx, 0.7))
    .connect(out);
  const drips = gain(ctx, 1);
  drips.connect(out);
  const cancel = sprinkle(ctx, 0.04, 0.35, (at) => {
    const src = ctx.createBufferSource();
    src.buffer = white;
    const bp = filter(ctx, 'bandpass', 2000 + Math.random() * 4000, 8);
    const env = gain(ctx, 0);
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.25 * Math.random(), at + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    src.connect(bp).connect(env).connect(drips);
    src.start(at, Math.random() * 2, 0.06);
  });
  return {
    stop(at) {
      cancel();
      hiss.stop(at);
      body.stop(at);
    },
  };
};

const barroom: Builder = (ctx, out) => {
  const murmur = loop(ctx, noiseBuffer(ctx, 4, true));
  const murmurGain = gain(ctx, 0.5);
  murmur
    .connect(filter(ctx, 'bandpass', 350, 0.8))
    .connect(murmurGain)
    .connect(out);
  // A slow swell so the crowd breathes instead of droning.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.13;
  const depth = gain(ctx, 0.18);
  lfo.connect(depth).connect(murmurGain.gain);
  lfo.start();
  const hum = ctx.createOscillator();
  hum.frequency.value = 55;
  hum.connect(gain(ctx, 0.05)).connect(out);
  hum.start();
  const cancel = sprinkle(ctx, 2.5, 7, (at) => {
    const ping = ctx.createOscillator();
    ping.frequency.value = 2200 + Math.random() * 1600;
    const env = gain(ctx, 0);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(0.05, at + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
    ping.connect(env).connect(out);
    ping.start(at);
    ping.stop(at + 0.65);
  });
  return {
    stop(at) {
      cancel();
      murmur.stop(at);
      lfo.stop(at);
      hum.stop(at);
    },
  };
};

const neonHum: Builder = (ctx, out) => {
  const buzz = ctx.createOscillator();
  buzz.type = 'sawtooth';
  buzz.frequency.value = 60;
  buzz
    .connect(filter(ctx, 'lowpass', 420))
    .connect(gain(ctx, 0.12))
    .connect(out);
  buzz.start();
  const overtone = ctx.createOscillator();
  overtone.frequency.value = 120;
  overtone.connect(gain(ctx, 0.05)).connect(out);
  overtone.start();
  const air = loop(ctx, noiseBuffer(ctx, 2, false));
  air
    .connect(filter(ctx, 'highpass', 3000))
    .connect(gain(ctx, 0.02))
    .connect(out);
  return {
    stop(at) {
      buzz.stop(at);
      overtone.stop(at);
      air.stop(at);
    },
  };
};

export const proceduralBeds = { rain, barroom, 'neon-hum': neonHum } as const;

/** Streams a looping file through a media element so long beds never sit decoded in memory. */
export function fileBed(url: string): Builder {
  return (ctx, out) => {
    const el = new Audio(url);
    el.crossOrigin = 'anonymous';
    el.loop = true;
    const node = ctx.createMediaElementSource(el);
    node.connect(out);
    void el.play().catch(() => undefined);
    return {
      stop(at) {
        setTimeout(
          () => {
            el.pause();
            node.disconnect();
            el.src = '';
          },
          Math.max(0, (at - ctx.currentTime) * 1000),
        );
      },
    };
  };
}
