// Native FLAG_SECURE via expo-screen-capture (tags are ref-counted by the library).
import { allowScreenCaptureAsync, preventScreenCaptureAsync } from 'expo-screen-capture';

export function preventCapture(tag: string): void {
  preventScreenCaptureAsync(tag).catch((e: unknown) =>
    console.warn('[writer] screen privacy unavailable', e),
  );
}

export function allowCapture(tag: string): void {
  allowScreenCaptureAsync(tag).catch(() => undefined);
}
