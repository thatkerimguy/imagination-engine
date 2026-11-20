// Expo Web (QA): the same bundled offline reader HTML, fetched from the exported static asset
// and handed to an iframe `srcDoc`, so web QA exercises the real offline bundle with no Vite.
import { Asset } from 'expo-asset';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const READER_ASSET = require('../../assets/reader-preview.html') as number;

let cached: Promise<string> | null = null;

export function loadOfflineReaderHtml(): Promise<string> {
  cached ??= (async () => {
    const res = await fetch(Asset.fromModule(READER_ASSET).uri);
    if (!res.ok) throw new Error(`The built-in reader answered HTTP ${res.status}.`);
    const html = await res.text();
    if (!html.includes('__KN_OFFLINE_PREVIEW__'))
      throw new Error('The built-in reader is damaged.');
    return html;
  })();
  cached.catch(() => (cached = null));
  return cached;
}
