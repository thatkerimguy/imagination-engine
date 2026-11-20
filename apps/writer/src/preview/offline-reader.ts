// Native: the built-in offline reader (apps/writer/assets/reader-preview.html, built by
// `pnpm build:preview-bundle`). Metro ships it as a static asset, never as Hermes JS; it is
// read once from the app bundle and kept in memory for every later preview.
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const READER_ASSET = require('../../assets/reader-preview.html') as number;

let cached: Promise<string> | null = null;

export function loadOfflineReaderHtml(): Promise<string> {
  cached ??= (async () => {
    const asset = await Asset.fromModule(READER_ASSET).downloadAsync();
    const html = await new File(asset.localUri ?? asset.uri).text();
    if (!html.includes('__KN_OFFLINE_PREVIEW__'))
      throw new Error('The built-in reader is damaged.');
    return html;
  })();
  cached.catch(() => (cached = null));
  return cached;
}
