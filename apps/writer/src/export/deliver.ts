// Native delivery: write the file to the cache directory and open the OS share sheet
// (Files, AirDrop, mail…).
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function deliverFile(
  filename: string,
  data: Uint8Array | string,
  mimeType: string,
): Promise<void> {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('Sharing is not available on this device.');
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  await file.write(data);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
}
