// Deletes cover image files (and their cached `.thumb.jpg` sidecars) that nothing references
// any more — called after Trash deletes items for good. Only touches files inside the app's own
// `Paths.document/covers/`; never throws.
import { Directory, File, Paths } from 'expo-file-system';
import { thumbUriForCover } from './cover-resize.ts';

const inCovers = (uri: string): boolean =>
  uri.startsWith(new Directory(Paths.document, 'covers').uri.replace(/\/?$/, '/'));

export async function deleteCoverFiles(uris: readonly string[]): Promise<void> {
  for (const uri of uris) {
    if (!inCovers(uri)) continue;
    for (const u of [uri, thumbUriForCover(uri)]) {
      try {
        const f = new File(u);
        if (f.exists) f.delete();
      } catch (err) {
        console.warn('[writer] cover cleanup failed', err);
      }
    }
  }
}
