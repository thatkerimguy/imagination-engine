import type { AudioBusAccess } from '@kn/core/renderer';

/** A short, quiet cybernetic harmonic whisper: two detuned partials plus a breath of noise. */
/** Returns a stop function that silences and disconnects everything immediately (or null). */
export function playWhisper(audio: AudioBusAccess): (() => void) | null {
  const ctx = audio.context;
  const out = audio.sfx;
  if (!ctx || !out) return null;
  const at = ctx.currentTime + 0.01;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(0.05, at + 0.25);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2600;
  env.connect(lp).connect(out);
  const nodes: AudioNode[] = [env, lp];
  for (const [freq, level] of [
    [392, 1],
    [588.7, 0.5],
    [783, 0.25],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = level;
    osc.connect(g).connect(env);
    osc.start(at);
    osc.stop(at + 1.2);
    nodes.push(osc, g);
  }
  const len = Math.floor(ctx.sampleRate * 0.6);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'bandpass';
  hp.frequency.value = 3200;
  const ng = ctx.createGain();
  ng.gain.value = 0.18;
  noise.connect(hp).connect(ng).connect(env);
  noise.start(at);
  nodes.push(noise, hp, ng);
  return () => {
    try {
      noise.stop();
    } catch {
      /* already stopped */
    }
    for (const n of nodes) n.disconnect();
  };
}
