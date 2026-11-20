// Rolling typing-speed meter: 60 s of *active* time; gaps over 5 s are idle and don't count.
import type { TypingMeter, TypingSpeed } from './metrics.ts';

const WINDOW_MS = 60_000;
const IDLE_MS = 5_000;
const MIN_MS = 1_000;

interface Sample {
  chars: number;
  ms: number;
}

export function createTypingMeter(): TypingMeter {
  let samples: Sample[] = [];
  let prevTotal: number | null = null;
  let prevTime = 0;
  const trim = (): void => {
    let total = samples.reduce((a, s) => a + s.ms, 0);
    while (total > WINDOW_MS && samples.length > 1) total -= samples.shift()!.ms;
  };
  return {
    record(totalChars, now) {
      if (prevTotal !== null) {
        const gap = Math.max(0, now - prevTime);
        samples.push({
          chars: Math.max(0, totalChars - prevTotal),
          ms: gap > IDLE_MS ? 0 : gap,
        });
        trim();
      }
      prevTotal = totalChars;
      prevTime = now;
    },
    speed(now): TypingSpeed {
      if (samples.length === 0) return { cpm: 0, wpm: 0 };
      const chars = samples.reduce((a, s) => a + s.chars, 0);
      const tail = Math.min(Math.max(0, now - prevTime), IDLE_MS);
      const ms = Math.max(MIN_MS, samples.reduce((a, s) => a + s.ms, 0) + tail);
      const cpm = (chars / ms) * 60_000;
      return { cpm, wpm: cpm / 5 };
    },
    reset() {
      samples = [];
      prevTotal = null;
      prevTime = 0;
    },
  };
}
