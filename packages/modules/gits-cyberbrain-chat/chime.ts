import type { AudioBusAccess } from '@kn/core/renderer';
import type { Encryption } from './schema.ts';

/** A soft two-partial bell; spoofed links get a detuned, slightly sour partial. */
export function playChime(audio: AudioBusAccess, encryption: Encryption, index: number): void {
  const ctx = audio.context;
  const out = audio.sfx;
  if (!ctx || !out) return;
  const at = ctx.currentTime + 0.01;
  const base = encryption === 'OPEN' ? 660 : 880;
  const ratio = encryption === 'SPOOFED' ? 1.47 : 1.5;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(0.07, at + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
  const lp = ctx.createBiquadFilter();
  lp.frequency.value = 3200;
  const pan = ctx.createStereoPanner();
  pan.pan.value = index % 2 === 0 ? 0.25 : -0.25;
  env.connect(lp).connect(pan).connect(out);
  for (const [freq, level] of [
    [base, 1],
    [base * ratio, 0.35],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = level;
    osc.connect(g).connect(env);
    osc.start(at);
    osc.stop(at + 1);
  }
  window.setTimeout(() => pan.disconnect(), 1200);
}
