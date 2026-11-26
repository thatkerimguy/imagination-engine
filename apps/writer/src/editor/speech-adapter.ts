// Native read-aloud adapter over expo-speech. Pause is stop-and-remember (Android cannot pause).
import * as Speech from 'expo-speech';
import type { SpeechAdapter } from './read-aloud.ts';

export const speechAdapter: SpeechAdapter = {
  speak(text, { rate, onDone, onError }) {
    Speech.speak(text, { rate, onDone, onError: () => onError() });
  },
  stop() {
    void Speech.stop();
  },
  available: () => true,
};
