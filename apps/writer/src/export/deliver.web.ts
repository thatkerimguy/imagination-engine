// Expo Web delivery: a Blob download through a temporary <a download> link.
export type DeliverResult = 'saved' | 'cancelled';

function download(filename: string, part: BlobPart, mimeType: string): DeliverResult {
  const url = URL.createObjectURL(new Blob([part], { type: mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'saved';
}

export const deliverText = async (
  filename: string,
  text: string,
  mimeType: string,
): Promise<DeliverResult> => download(filename, text, mimeType);

export const deliverBytes = async (
  filename: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<DeliverResult> => download(filename, new Uint8Array(bytes), mimeType);

export async function deliverBase64(
  filename: string,
  base64: string,
  mimeType: string,
): Promise<DeliverResult> {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return download(filename, bytes, mimeType);
}
