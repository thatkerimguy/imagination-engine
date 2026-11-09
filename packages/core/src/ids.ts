const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
// Largest multiple of 62 that fits in a byte; bytes above it are rejected to avoid modulo bias.
const LIMIT = 248;

/**
 * Creates a short random id such as `psg_4fK9xQ2mZa`. Ids are stable references in project data,
 * saves and translations, so never derive them from array positions or titles.
 */
export function createId(prefix = '', length = 10): string {
  if (!Number.isInteger(length) || length < 4) {
    throw new RangeError(`Id length must be an integer of at least 4, got ${length}.`);
  }
  let out = '';
  const bytes = new Uint8Array(length * 2);
  while (out.length < length) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < LIMIT) out += ALPHABET[byte % 62];
      if (out.length === length) break;
    }
  }
  return prefix ? `${prefix}_${out}` : out;
}
