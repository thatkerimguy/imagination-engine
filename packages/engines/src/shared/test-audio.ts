// Recording fake of the WebAudio nodes procedural engines use (happy-dom has none). Tests only.

export interface FakeGraph {
  kind: 'bed' | 'oneshot';
  closed: boolean;
  context: BaseAudioContext;
  out: GainNode;
}

/** Minimal recording fake of the WebAudio nodes procedural engines use (happy-dom has none). */
export function fakeGraph(kind: 'bed' | 'oneshot'): FakeGraph {
  const param = (v: number): AudioParam =>
    ({
      value: v,
      setValueAtTime: () => undefined,
      linearRampToValueAtTime: () => undefined,
      exponentialRampToValueAtTime: () => undefined,
      setTargetAtTime: () => undefined,
      cancelScheduledValues: () => undefined,
    }) as unknown as AudioParam;
  const node = (): Record<string, unknown> => ({
    connect: (n: unknown) => n,
    disconnect: () => undefined,
    start: () => undefined,
    stop: () => undefined,
    onended: null,
    gain: param(1),
    frequency: param(440),
    detune: param(0),
    Q: param(1),
    playbackRate: param(1),
    pan: param(0),
    type: 'sine',
    buffer: null,
    loop: false,
  });
  const context = {
    currentTime: 0,
    sampleRate: 22050,
    state: 'running',
    destination: node(),
    createGain: node,
    createOscillator: node,
    createBiquadFilter: node,
    createBufferSource: node,
    createStereoPanner: node,
    createBuffer: (ch: number, len: number, rate: number) => ({
      numberOfChannels: ch,
      length: len,
      sampleRate: rate,
      duration: len / rate,
      getChannelData: () => new Float32Array(len),
    }),
  } as unknown as BaseAudioContext;
  return { kind, closed: false, context, out: node() as unknown as GainNode };
}
