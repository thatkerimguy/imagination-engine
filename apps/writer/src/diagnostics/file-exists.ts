// Native check that a `file://` URI still exists on this device.
import { File } from 'expo-file-system';

export const fileExists = async (uri: string): Promise<boolean> => {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
};
