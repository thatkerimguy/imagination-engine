// Subtle tactile feedback. Haptics are a nicety: unsupported platforms (web) silently skip.
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export function tapFeedback(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function toggleFeedback(on: boolean): void {
  if (Platform.OS === 'web') return;
  const style = on ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
  Haptics.impactAsync(style).catch(() => undefined);
}
