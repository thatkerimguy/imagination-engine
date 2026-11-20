// Expo Web delivery: a Blob download through a temporary <a download> link.
export async function deliverFile(
  filename: string,
  data: Uint8Array | string,
  mimeType: string,
): Promise<void> {
  const part: BlobPart = typeof data === 'string' ? data : new Uint8Array(data);
  const url = URL.createObjectURL(new Blob([part], { type: mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
