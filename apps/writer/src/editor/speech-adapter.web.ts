// Web read-aloud adapter: the browser's speechSynthesis when present, else an unavailable no-op.
// Reached through `globalThis` with a runtime guard; the shapes are typed locally (no DOM lib).
import type { SpeechAdapter } from './read-aloud.ts';

interface Utterance {
  rate: number;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
interface Synth {
  speak(u: Utterance): void;
  cancel(): void;
}
type UtteranceCtor = new (text: string) => Utterance;

function synth(): { synth: Synth; Utterance: UtteranceCtor } | null {
  const g = globalThis as { speechSynthesis?: Synth; SpeechSynthesisUtterance?: UtteranceCtor };
  return g.speechSynthesis && g.SpeechSynthesisUtterance
    ? { synth: g.speechSynthesis, Utterance: g.SpeechSynthesisUtterance }
    : null;
}

export const speechAdapter: SpeechAdapter = {
  speak(text, { rate, onDone, onError }) {
    const s = synth();
    if (!s) return onError();
    const u = new s.Utterance(text);
    u.rate = rate;
    u.onend = onDone;
    // Cancelling reports "canceled"/"interrupted"; the controller ignores stale callbacks.
    u.onerror = onError;
    s.synth.speak(u);
  },
  stop() {
    synth()?.synth.cancel();
  },
  available: () => synth() !== null,
};
