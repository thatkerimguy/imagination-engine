// Hands plain text to the user: the native share sheet (no clipboard package is installed).
import { Share } from 'react-native';

/** Returns true when the text was shared. */
export async function shareText(text: string, title?: string): Promise<boolean> {
  try {
    const r = await Share.share({ message: text, title });
    return r.action !== Share.dismissedAction;
  } catch {
    return false;
  }
}
