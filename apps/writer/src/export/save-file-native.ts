// Saves an export through the platform's own file picker. Android: the local SaveFile module
// (ACTION_CREATE_DOCUMENT, written by plugins/with-android-polish.js); in Expo Go, where that
// module is missing, the Storage Access Framework folder picker. Never the Android share sheet.
// iOS: the share sheet, whose "Save to Files" is the system file picker there.
import { File, Paths } from 'expo-file-system';
import { EncodingType, StorageAccessFramework } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { NativeModules, Platform } from 'react-native';

export type DeliverResult = 'saved' | 'cancelled';

interface SaveFileNative {
  saveFile(filename: string, mimeType: string, base64Data: string): Promise<string>;
}

function nativeModule(): SaveFileNative | null {
  const m = (NativeModules as { SaveFile?: SaveFileNative }).SaveFile;
  return m && typeof m.saveFile === 'function' ? m : null;
}

async function saveViaFolderPicker(
  filename: string,
  mimeType: string,
  base64Data: string,
): Promise<DeliverResult> {
  const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) return 'cancelled';
  const stem = filename.replace(/\.[^.]+$/, '');
  const uri = await StorageAccessFramework.createFileAsync(perm.directoryUri, stem, mimeType);
  await StorageAccessFramework.writeAsStringAsync(uri, base64Data, {
    encoding: EncodingType.Base64,
  });
  return 'saved';
}

async function saveViaShareSheet(
  filename: string,
  mimeType: string,
  base64Data: string,
): Promise<DeliverResult> {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('Saving files is not available on this device.');
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(base64Data, { encoding: 'base64' });
  try {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
  } finally {
    if (file.exists) file.delete();
  }
  return 'saved';
}

export async function saveFileNative(
  filename: string,
  mimeType: string,
  base64Data: string,
): Promise<DeliverResult> {
  if (Platform.OS === 'android') {
    const native = nativeModule();
    if (!native) return saveViaFolderPicker(filename, mimeType, base64Data);
    return (await native.saveFile(filename, mimeType, base64Data)) === 'saved'
      ? 'saved'
      : 'cancelled';
  }
  return saveViaShareSheet(filename, mimeType, base64Data);
}
