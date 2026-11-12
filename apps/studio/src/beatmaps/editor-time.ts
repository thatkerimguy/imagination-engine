/**
 * The editor's playhead in song milliseconds. It changes every frame while a song plays, so the
 * field and timeline canvases listen to it directly instead of re-rendering React each frame.
 */
export class EditorTime {
  private value = 0;
  private readonly listeners = new Set<(t: number) => void>();

  get t(): number {
    return this.value;
  }

  set(t: number): void {
    const next = Math.max(0, Math.round(t));
    if (next === this.value) return;
    this.value = next;
    for (const listener of this.listeners) listener(next);
  }

  subscribe(listener: (t: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/** Loudest sample per this many ms of song, for the timeline's waveform. */
export const PEAK_MS = 10;

/** Peaks of a decoded song, one per PEAK_MS, 0–1 (computed once per song). */
export function songPeaks(buffer: AudioBuffer): Float32Array {
  const step = Math.max(1, Math.round((buffer.sampleRate * PEAK_MS) / 1000));
  const out = new Float32Array(Math.ceil(buffer.length / step));
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < out.length; i++) {
      let peak = out[i] as number;
      const end = Math.min(data.length, (i + 1) * step);
      for (let k = i * step; k < end; k++) {
        const v = Math.abs(data[k] as number);
        if (v > peak) peak = v;
      }
      out[i] = peak;
    }
  }
  return out;
}
