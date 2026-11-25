// Android external backup folder (Storage Access Framework). The Author picks a visible folder
// (e.g. Documents/ImaginationEngine or a Syncthing folder) once; `requestDirectoryPermissionsAsync`
// (expo-file-system/legacy) runs ACTION_OPEN_DOCUMENT_TREE and calls
// `ContentResolver.takePersistableUriPermission` on the grant, so access survives app restarts and
// reboots. Files written there are owned by the user, so they survive an uninstall.
// expo/expo#42273: never stream a zip straight into a content:// URI — the archive is finalized
// in memory and in the app-private snapshot first, then written in one base64 call.
import { EncodingType, StorageAccessFramework } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { bytesToBase64 } from '../export/base64.ts';
import { safFolderLabel, safMirrorName, safMirrorsToPrune } from './saf-names.ts';

export const SAF_SUPPORTED = Platform.OS === 'android';

export interface SafFolder {
  uri: string;
  label: string;
}

/** Opens the system folder picker. `null` when cancelled or not on Android. */
export async function pickSafFolder(): Promise<SafFolder | null> {
  if (!SAF_SUPPORTED) return null;
  const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) return null;
  return { uri: perm.directoryUri, label: safFolderLabel(perm.directoryUri) };
}

/**
 * Writes `bytes` as `kinetic-writer-auto-YYYYMMDD-HHmm.zip` into the folder and prunes older
 * mirrored snapshots (only ours) down to the newest 5. Throws when the folder is gone or access
 * was revoked; the caller records that as a non-fatal warning.
 */
export async function mirrorToSaf(
  folderUri: string,
  bytes: Uint8Array,
  now: number,
): Promise<string | null> {
  const stem = safMirrorName(now).replace(/\.zip$/, '');
  const uri = await StorageAccessFramework.createFileAsync(folderUri, stem, 'application/zip');
  await StorageAccessFramework.writeAsStringAsync(uri, bytesToBase64(bytes), {
    encoding: EncodingType.Base64,
  });
  try {
    const listing = await StorageAccessFramework.readDirectoryAsync(folderUri);
    for (const old of safMirrorsToPrune(listing))
      await StorageAccessFramework.deleteAsync(old, { idempotent: true });
  } catch (err) {
    console.warn('[writer] external backup pruning failed', err);
  }
  return uri;
}
