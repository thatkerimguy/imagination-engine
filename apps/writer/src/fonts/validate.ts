// Pure custom-font validation (no react-native / expo imports, so it is unit-testable).
export type FontFormat = 'ttf' | 'otf';

/** Largest font accepted on web, where the bytes are stored inline as a data URI. */
export const MAX_WEB_FONT_BYTES = 2 * 1024 * 1024;

/** Detects the sfnt container from its first four bytes (0x00010000 / 'true' → ttf, 'OTTO' → otf). */
export function fontFormatFromHeader(bytes: Uint8Array): FontFormat | null {
  if (bytes.length < 4) return null;
  const [a, b, c, d] = bytes as unknown as [number, number, number, number];
  if (a === 0x00 && b === 0x01 && c === 0x00 && d === 0x00) return 'ttf';
  const tag = String.fromCharCode(a, b, c, d);
  if (tag === 'true') return 'ttf';
  if (tag === 'OTTO') return 'otf';
  return null;
}

/** `.ttf` / `.otf` (case-insensitive) → format, anything else → null. */
export function extensionFormat(name: string): FontFormat | null {
  const m = /\.(ttf|otf)$/i.exec(name.trim());
  return m ? (m[1]!.toLowerCase() as FontFormat) : null;
}

/** Null when the size is acceptable, otherwise a friendly message. */
export function checkFontSize(bytes: Uint8Array): string | null {
  if (bytes.length === 0) return 'That font file is empty.';
  if (bytes.length > MAX_WEB_FONT_BYTES)
    return 'That font is larger than 2 MB. Pick a smaller one.';
  return null;
}

/** Typed error whose message is safe to show to the Author. */
export class FontImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FontImportError';
  }
}

/** Validates name + bytes and returns the real format, or throws a FontImportError. */
export function validateFontFile(name: string, bytes: Uint8Array): FontFormat {
  const ext = extensionFormat(name);
  if (!ext) throw new FontImportError('Please choose a .ttf or .otf font file.');
  const header = fontFormatFromHeader(bytes);
  if (!header) throw new FontImportError('That file is not a valid TrueType/OpenType font.');
  return header;
}

/** Friendly display name from a file name (extension and separators stripped). */
export const displayNameFromFile = (name: string): string =>
  name
    .replace(/\.(ttf|otf)$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim() || 'Custom font';
