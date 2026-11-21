// Turns a stored cover URI into a publishable cover. Pure: the platform file read is injected,
// so the native reader (`read-cover.ts`), the web reader and unit tests share one rule set.
import {
  COVER_MIMES,
  MAX_COVER_BYTES,
  type CoverMime,
  type PublishCover,
} from '../../../publish-api/src/protocol.ts';

/** A cover that exists but cannot be sent; `warning` is shown to the Author, publish continues. */
export interface CoverSkip {
  warning: string;
}

export type CoverResult = PublishCover | CoverSkip | null;
export type CoverReader = (uri: string) => Promise<CoverResult>;
/** Reads a local file as base64 (native: expo-file-system `File.base64()`). */
export type ReadFileBase64 = (uri: string) => Promise<string>;

export const isCoverSkip = (r: CoverResult): r is CoverSkip => r !== null && 'warning' in r;

const DATA_URI = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=\s]+)$/i;

const EXT_MIME: Record<string, CoverMime> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Decoded byte length of a base64 string without decoding it. */
export function base64ByteLength(b64: string): number {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

/** Magic-byte sniff from the first base64 characters (enough for JPEG / PNG / WebP). */
export function sniffMime(b64: string): CoverMime | null {
  if (b64.startsWith('/9j/')) return 'image/jpeg';
  if (b64.startsWith('iVBORw0KGgo')) return 'image/png';
  if (!b64.startsWith('UklGR')) return null;
  // RIFF....WEBP: bytes 8–11 straddle base64 groups, so decode the 12-byte header.
  try {
    return atob(b64.slice(0, 16)).slice(8, 12) === 'WEBP' ? 'image/webp' : null;
  } catch {
    return null;
  }
}

export function mimeFromExtension(uri: string): CoverMime | null {
  const ext = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(uri)?.[1]?.toLowerCase();
  return ext ? (EXT_MIME[ext] ?? null) : null;
}

const megabytes = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(1);

/** Validates mime + size; the bytes win over the extension when they disagree. */
export function coverFromBase64(rawB64: string, hint: CoverMime | null): CoverResult {
  const base64 = rawB64.replace(/\s+/g, '');
  if (!base64) return null;
  const mime = sniffMime(base64) ?? hint;
  if (!mime || !COVER_MIMES.includes(mime)) {
    return { warning: 'The cover must be a JPEG, PNG or WebP image and will be left out.' };
  }
  const bytes = base64ByteLength(base64);
  if (bytes > MAX_COVER_BYTES) {
    return {
      warning: `The cover image is ${megabytes(bytes)} MB (limit ${megabytes(MAX_COVER_BYTES)} MB) and will be left out. Pick a smaller image to include it.`,
    };
  }
  return { mime, base64 };
}

export function parseDataUriCover(uri: string): CoverResult {
  const m = DATA_URI.exec(uri.trim());
  if (!m) return null;
  const declared = m[1]!.toLowerCase();
  const hint = COVER_MIMES.find((c) => c === declared) ?? null;
  return coverFromBase64(m[2]!, hint);
}

/**
 * `data:` URIs pass through validation; `file://` URIs are read with `readFile` when given
 * (native), and skipped otherwise (web, where covers are always stored as data URIs).
 */
export function createCoverReader(readFile: ReadFileBase64 | null): CoverReader {
  return async (uri) => {
    const trimmed = uri.trim();
    if (trimmed.startsWith('data:')) return parseDataUriCover(trimmed);
    if (!readFile || !trimmed.startsWith('file://')) return null;
    return coverFromBase64(await readFile(trimmed), mimeFromExtension(trimmed));
  };
}
