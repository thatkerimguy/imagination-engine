// Copy a link: the browser clipboard on web; on native (no clipboard module installed) the system
// share sheet, where "Copy" is one tap away.
import { Platform, Share } from 'react-native';

export type CopyResult = 'copied' | 'shared' | 'failed';

function copyViaTextarea(text: string): boolean {
  const doc = globalThis.document;
  const area = doc.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  doc.body.appendChild(area);
  area.select();
  try {
    return doc.execCommand('copy');
  } catch {
    return false;
  } finally {
    doc.body.removeChild(area);
  }
}

export async function copyText(text: string): Promise<CopyResult> {
  if (Platform.OS === 'web') {
    try {
      await globalThis.navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      return copyViaTextarea(text) ? 'copied' : 'failed';
    }
  }
  try {
    await Share.share({ message: text });
    return 'shared';
  } catch {
    return 'failed';
  }
}
