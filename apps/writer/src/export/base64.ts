// Pure, chunk-safe base64 for export payloads. Never spreads a large array into
// String.fromCharCode, so multi-megabyte .zip / .pdf / .knbook bytes cannot overflow the stack.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** Bytes per encoded chunk: a multiple of 3, so chunks concatenate without padding. */
const CHUNK = 3 * 8192;

function encodeChunk(bytes: Uint8Array, from: number, to: number): string {
  const out: string[] = [];
  for (let i = from; i < to; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < to ? bytes[i + 1]! : 0;
    const c = i + 2 < to ? bytes[i + 2]! : 0;
    const n = (a << 16) | (b << 8) | c;
    out.push(
      ALPHABET[(n >> 18) & 63]! +
        ALPHABET[(n >> 12) & 63]! +
        (i + 1 < to ? ALPHABET[(n >> 6) & 63]! : '=') +
        (i + 2 < to ? ALPHABET[n & 63]! : '='),
    );
  }
  return out.join('');
}

export function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK)
    parts.push(encodeChunk(bytes, i, Math.min(bytes.length, i + CHUNK)));
  return parts.join('');
}

/** UTF-8 text (JSON, Markdown, HTML, TXT) to base64. */
export function textToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}
