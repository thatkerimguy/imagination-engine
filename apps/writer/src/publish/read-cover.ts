// Native cover reader: local `file://` covers (copied in by pick-cover.ts) are read with
// expo-file-system; `data:` URIs pass through. Metro picks `read-cover.web.ts` on web.
import { File } from 'expo-file-system';
import { createCoverReader } from './cover-data.ts';

export const readCover = createCoverReader((uri) => new File(uri).base64());
