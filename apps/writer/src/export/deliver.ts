// Native delivery: encode to base64 and hand off to the platform file picker
// (save-file-native.ts: Android "Save as…", iOS share sheet with Save to Files).
import { bytesToBase64, textToBase64 } from './base64.ts';
import { saveFileNative, type DeliverResult } from './save-file-native.ts';

export type { DeliverResult } from './save-file-native.ts';

/** Saves UTF-8 text. Resolves 'cancelled' when the user dismisses the picker. */
export const deliverText = (
  filename: string,
  text: string,
  mimeType: string,
): Promise<DeliverResult> => saveFileNative(filename, mimeType, textToBase64(text));

/** Saves binary data. Resolves 'cancelled' when the user dismisses the picker. */
export const deliverBytes = (
  filename: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<DeliverResult> => saveFileNative(filename, mimeType, bytesToBase64(bytes));

/** Saves already-base64 data (e.g. a PDF read back from cache) without decode/re-encode. */
export const deliverBase64 = (
  filename: string,
  base64: string,
  mimeType: string,
): Promise<DeliverResult> => saveFileNative(filename, mimeType, base64);
