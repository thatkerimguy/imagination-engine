// Web cover reader: covers are stored as `data:` URIs; anything else is skipped quietly.
import { createCoverReader } from './cover-data.ts';

export const readCover = createCoverReader(null);
