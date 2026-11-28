// Procedural ambience for audio-bed: cached noise buffers -> filter (slow LFO) -> level gain.
// No audio files. Every node is tracked so `stop()` can halt and disconnect all of them.
export type SceneId =
  'rain-tin' | 'barroom-hum' | 'starship-bridge' | 'ocean-surf' | 'forest-wind' | 'vinyl-crackle';
type Buf = 'white' | 'pink' | 'pops';

interface Scene {
  buf: Buf;
  type: BiquadFilterType;
  freq: number;
  q: number;
  lfo: number;
  depth: number; // LFO swing on the filter frequency (Hz)
  swell: number; // LFO swing on the loudness (0..1)
  drone: number; // warm sub oscillator (Hz), 0 = none
  level: number;
}

export const SCENES: Record<SceneId, Scene> = {
  'rain-tin': {
    buf: 'white',
    type: 'bandpass',
    freq: 3200,
    q: 0.7,
    lfo: 0.13,
    depth: 500,
    swell: 0.18,
    drone: 0,
    level: 0.55,
  },
  'barroom-hum': {
    buf: 'pink',
    type: 'bandpass',
    freq: 520,
    q: 0.5,
    lfo: 0.21,
    depth: 140,
    swell: 0.25,
    drone: 55,
    level: 1.2,
  },
  'starship-bridge': {
    buf: 'pink',
    type: 'lowpass',
    freq: 380,
    q: 0.8,
    lfo: 0.07,
    depth: 90,
    swell: 0.1,
    drone: 55,
    level: 1.3,
  },
  'ocean-surf': {
    buf: 'pink',
    type: 'lowpass',
    freq: 650,
    q: 0.4,
    lfo: 0.09,
    depth: 300,
    swell: 0.6,
    drone: 0,
    level: 1.2,
  },
  'forest-wind': {
    buf: 'pink',
    type: 'bandpass',
    freq: 900,
    q: 0.35,
    lfo: 0.11,
    depth: 350,
    swell: 0.4,
    drone: 0,
    level: 1,
  },
  'vinyl-crackle': {
    buf: 'pops',
    type: 'highpass',
    freq: 1800,
    q: 0.5,
    lfo: 0.05,
    depth: 200,
    swell: 0,
    drone: 60,
    level: 0.8,
  },
};
export const SCENE_IDS = Object.keys(SCENES) as SceneId[];

const cache = new WeakMap<BaseAudioContext, Partial<Record<Buf, AudioBuffer>>>();

function makeBuffer(ac: BaseAudioContext, kind: Buf): AudioBuffer {
  const buf = ac.createBuffer(1, Math.round(ac.sampleRate * 2), ac.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w;
    else if (kind === 'pink') {
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    } else d[i] = Math.random() < 0.0002 ? w * 0.9 : w * 0.03;
  }
  return buf;
}

/** One ~2 s loopable buffer per kind per context. */
export function noiseBuffer(ac: BaseAudioContext, kind: Buf): AudioBuffer {
  const slot = cache.get(ac) ?? {};
  cache.set(ac, slot);
  return (slot[kind] ??= makeBuffer(ac, kind));
}

export function ramp(ac: BaseAudioContext, p: AudioParam, to: number, ms: number): void {
  const t = ac.currentTime;
  p.cancelScheduledValues(t);
  p.setValueAtTime(p.value, t);
  p.linearRampToValueAtTime(to, t + ms / 1000);
}

export interface BuiltBed {
  /** Level gain (starts at 0); ramp this. */
  level: GainNode;
  stop(): void;
}

export function buildBed(ac: BaseAudioContext, out: AudioNode, s: Scene): BuiltBed {
  const nodes: AudioNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];
  const add = <T extends AudioNode>(n: T): T => (nodes.push(n), n);
  const level = add(ac.createGain());
  level.gain.value = 0;
  const wob = add(ac.createGain());
  wob.gain.value = 1 - s.swell;
  const flt = add(ac.createBiquadFilter());
  flt.type = s.type;
  flt.frequency.value = s.freq;
  flt.Q.value = s.q;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, s.buf);
  src.loop = true;
  sources.push(src);
  nodes.push(src);
  src.connect(flt);
  flt.connect(wob);
  wob.connect(level);
  level.connect(out);

  const lfo = ac.createOscillator();
  lfo.frequency.value = s.lfo;
  sources.push(lfo);
  nodes.push(lfo);
  const toFreq = add(ac.createGain());
  toFreq.gain.value = s.depth;
  lfo.connect(toFreq);
  toFreq.connect(flt.frequency);
  if (s.swell > 0) {
    const toGain = add(ac.createGain());
    toGain.gain.value = s.swell;
    lfo.connect(toGain);
    toGain.connect(wob.gain);
  }
  if (s.drone > 0) {
    for (const [mult, amp] of [
      [1, 0.05],
      [1.5, 0.025],
    ] as const) {
      const o = ac.createOscillator();
      o.frequency.value = s.drone * mult;
      const dg = add(ac.createGain());
      dg.gain.value = amp;
      o.connect(dg);
      dg.connect(level);
      sources.push(o);
      nodes.push(o);
    }
  }
  sources.forEach((n) => n.start());
  return {
    level,
    stop(): void {
      for (const n of sources) {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      }
      for (const n of nodes) n.disconnect();
    },
  };
}
