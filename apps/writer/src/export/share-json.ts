// Native: share the JSON as a file (Files, AirDrop, email…). Falls back to sharing it as text
// when file sharing is unavailable.
import { Share } from 'react-native';
import { deliverFile } from './deliver.ts';

export async function shareJson(filename: string, data: unknown): Promise<void> {
  const json = `${JSON.stringify(data, null, 2)}\n`;
  try {
    await deliverFile(filename, json, 'application/json');
    return;
  } catch (err) {
    console.warn('[writer] file share failed, sharing as text', err);
  }
  await Share.share({ title: filename, message: json });
}
