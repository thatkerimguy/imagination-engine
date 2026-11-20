// Reads a picked document's bytes: web `asset.file` / fetch, native expo-file-system `File`.
import { File } from 'expo-file-system';
import type { DocumentPickerAsset } from 'expo-document-picker';

export async function readAssetBytes(asset: DocumentPickerAsset): Promise<Uint8Array> {
  if (asset.file) return new Uint8Array(await asset.file.arrayBuffer());
  if (/^(blob|data|https?):/i.test(asset.uri)) {
    return new Uint8Array(await (await fetch(asset.uri)).arrayBuffer());
  }
  return new File(asset.uri).bytes();
}
