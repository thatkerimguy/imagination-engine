// Native: save the JSON as a file through the platform file picker. Errors surface to the caller.
import { deliverText, type DeliverResult } from './deliver';

export async function shareJson(filename: string, data: unknown): Promise<DeliverResult> {
  return deliverText(filename, `${JSON.stringify(data, null, 2)}\n`, 'application/json');
}
