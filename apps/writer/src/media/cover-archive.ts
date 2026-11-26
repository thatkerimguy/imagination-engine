// Native cover file access for workspace backups (backup/archive-covers.ts): reads covers by URI
// and writes restored ones into this device's `Paths.document/covers/`. Never throws on read.
import { Directory, File, Paths } from 'expo-file-system';
import type { CoverMedia } from '../backup/archive-covers.ts';

export const coverArchiveMedia: CoverMedia | undefined = {
  async read(uri) {
    try {
      const f = new File(uri);
      return f.exists ? await f.bytes() : null;
    } catch {
      return null;
    }
  },
  async write(name, bytes) {
    const dir = new Directory(Paths.document, 'covers');
    dir.create({ idempotent: true, intermediates: true });
    const f = new File(dir, name);
    if (f.exists) f.delete();
    f.create();
    f.write(bytes);
    return f.uri;
  },
};
