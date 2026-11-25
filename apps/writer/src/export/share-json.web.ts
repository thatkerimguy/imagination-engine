// Expo Web: download the JSON as a file.
import { deliverText, type DeliverResult } from './deliver.web.ts';

export async function shareJson(filename: string, data: unknown): Promise<DeliverResult> {
  return deliverText(filename, `${JSON.stringify(data, null, 2)}\n`, 'application/json');
}
