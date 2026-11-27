// One-shot procedural foley (FM + filtered noise), each recipe <= 0.9 s. Every node is tracked;
// sources free themselves via `onended`, and `sweep()` stops and disconnects whatever is left.
export type Foley =
  | 'unsheathe'
  | 'thunder'
  | 'level-chord'
  | 'revolver-click'
  | 'typewriter-bell'
  | 'heartbeat'
  | 'radio-static';
export const FOLEYS: readonly Foley[] = [
  'unsheathe',
  'thunder',
  'level-chord',
  'revolver-click',
  'typewriter-bell',
  'heartbeat',
  'radio-static',
];
export const MAX_S = 0.9;

export interface Shot {
  sweep(): void;
}

export function play(
  ac: BaseAudioContext,
  out: AudioNode,
  foley: Foley,
  gain: number,
  pitch: number,
): Shot {
  const live = new Set<AudioNode>();
  const srcs = new Set<AudioScheduledSourceNode>();
  const pr = 2 ** (pitch / 12);
  const t0 = ac.currentTime;
  const free = (src: AudioScheduledSourceNode, ...rest: AudioNode[]): void => {
    src.onended = () => {
      for (const n of [src, ...rest]) {
        n.disconnect();
        live.delete(n);
      }
      srcs.delete(src);
    };
    srcs.add(src);
    live.add(src);
    rest.forEach((n) => live.add(n));
  };
  const env = (at: number, dur: number, peak: number): GainNode => {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0 + at);
    g.gain.linearRampToValueAtTime(peak * gain, t0 + at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
    g.connect(out);
    return g;
  };
  /** FM tone: carrier f0 -> f1, optional modulator at `ratio` with index `idx`. */
  const tone = (
    type: OscillatorType,
    f0: number,
    f1: number,
    at: number,
    dur: number,
    peak: number,
    ratio = 0,
    idx = 0,
  ): void => {
    const o = ac.createOscillator();
    const g = env(at, dur, peak);
    o.type = type;
    o.frequency.setValueAtTime(f0 * pr, t0 + at);
    o.frequency.exponentialRampToValueAtTime(f1 * pr, t0 + at + dur);
    o.connect(g);
    const extra: AudioNode[] = [g];
    if (ratio > 0) {
      const m = ac.createOscillator();
      const mg = ac.createGain();
      m.frequency.value = f0 * pr * ratio;
      mg.gain.value = f0 * pr * idx;
      m.connect(mg);
      mg.connect(o.frequency);
      m.start(t0 + at);
      m.stop(t0 + at + dur + 0.02);
      free(m, mg);
    }
    o.start(t0 + at);
    o.stop(t0 + at + dur + 0.02);
    free(o, ...extra);
  };
  const hiss = (
    type: BiquadFilterType,
    f0: number,
    f1: number,
    at: number,
    dur: number,
    peak: number,
    q = 1,
  ): void => {
    const s = ac.createBufferSource();
    const buf = ac.createBuffer(1, Math.round(ac.sampleRate * dur), ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    s.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0 + at);
    f.frequency.exponentialRampToValueAtTime(f1, t0 + at + dur);
    const g = env(at, dur, peak);
    s.connect(f);
    f.connect(g);
    s.start(t0 + at);
    s.stop(t0 + at + dur);
    free(s, f, g);
  };

  switch (foley) {
    case 'unsheathe':
      hiss('bandpass', 2200, 7500, 0, 0.6, 0.5, 3);
      tone('sine', 1800, 3800, 0.05, 0.5, 0.12);
      break;
    case 'thunder':
      hiss('lowpass', 260, 90, 0, 0.9, 0.9);
      tone('sawtooth', 62, 34, 0.02, 0.85, 0.3);
      break;
    case 'level-chord':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone('sine', f, f, i * 0.07, 0.6, 0.22, 2, 0.4),
      );
      break;
    case 'revolver-click':
      for (const at of [0, 0.14]) {
        hiss('highpass', 3500, 6000, at, 0.04, 0.6);
        tone('square', 900, 260, at, 0.05, 0.2);
      }
      break;
    case 'typewriter-bell':
      hiss('highpass', 4000, 6000, 0, 0.03, 0.4);
      tone('sine', 2200, 2200, 0.02, 0.85, 0.3, 3.5, 2);
      break;
    case 'heartbeat':
      tone('sine', 70, 38, 0, 0.18, 0.9);
      tone('sine', 62, 34, 0.26, 0.2, 0.7);
      break;
    case 'radio-static':
      for (let i = 0; i < 8; i++)
        hiss(
          'bandpass',
          1800 + 500 * (i % 3),
          2600,
          i * 0.1,
          0.09,
          0.2 + (0.25 * ((i * 7) % 4)) / 4,
          0.8,
        );
      break;
  }
  return {
    sweep(): void {
      for (const s of srcs) {
        try {
          s.stop();
        } catch {
          /* not started or already stopped */
        }
        s.onended = null;
      }
      for (const n of live) n.disconnect();
      live.clear();
      srcs.clear();
    },
  };
}
