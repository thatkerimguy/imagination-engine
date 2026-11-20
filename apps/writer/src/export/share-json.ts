// Native: write the JSON to a cache file and open the OS share sheet (Files, AirDrop, email…).
// Falls back to sharing the JSON as text when file sharing is unavailable.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

export async function shareJson(filename: string, data: unknown): Promise<void> {
  const json = `${JSON.stringify(data, null, 2)}\n`;
  try {
    if (await Sharing.isAvailableAsync()) {
      const file = new File(Paths.cache, filename);
      if (file.exists) file.delete();
      file.create();
      file.write(json);
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: filename });
      return;
    }
  } catch (err) {
    console.warn('[writer] file share failed, sharing as text', err);
  }
  await Share.share({ title: filename, message: json });
}
