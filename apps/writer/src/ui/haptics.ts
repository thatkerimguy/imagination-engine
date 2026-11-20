// Subtle tactile feedback. Haptics are a nicety: unsupported platforms (web) silently skip.
// The on/off preference lives in WriterPrefs; a module flag keeps the callers synchronous.
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { loadWriterPrefs } from '../store/writer-prefs.ts';
import type { NovelRepository } from '../store/repository.ts';

let enabled = true;

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

/** Load the saved preference into the module flag. Call once at app start. */
export async function syncHapticsPref(repo: NovelRepository): Promise<void> {
  const prefs = await loadWriterPrefs(repo);
  enabled = prefs.hapticsEnabled;
}

export function tapFeedback(): void {
  if (!enabled || Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function toggleFeedback(on: boolean): void {
  if (!enabled || Platform.OS === 'web') return;
  const style = on ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
  Haptics.impactAsync(style).catch(() => undefined);
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Light, medium, success: runs regardless of the enabled flag (the Test vibration button). */
export async function hapticTestSequence(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await wait(120);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await wait(120);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // unsupported device: nothing to feel
  }
}
