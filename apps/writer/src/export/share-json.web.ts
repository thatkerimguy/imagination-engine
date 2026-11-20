// Expo Web: download the JSON as a file.
import { deliverFile } from './deliver.web.ts';

export async function shareJson(filename: string, data: unknown): Promise<void> {
  await deliverFile(filename, `${JSON.stringify(data, null, 2)}\n`, 'application/json');
}
