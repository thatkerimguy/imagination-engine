// Hashing and randomness for the lock. expo-crypto is loaded lazily so this module stays
// importable under node (vitest); any failure falls back to the pure-JS implementation.
import { sha256Pure } from './sha256.ts';

export { sha256Pure } from './sha256.ts';

export async function sha256Hex(text: string): Promise<string> {
  try {
    const Crypto = await import('expo-crypto');
    return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
  } catch {
    return sha256Pure(text);
  }
}

/** `n` random bytes: expo-crypto when available, else `crypto.getRandomValues`, else Math.random. */
export async function randomBytes(n: number): Promise<Uint8Array> {
  try {
    const Crypto = await import('expo-crypto');
    const bytes = Crypto.getRandomBytes(n);
    if (bytes.length === n) return bytes;
  } catch {
    // fall through
  }
  const out = new Uint8Array(n);
  const web = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } })
    .crypto;
  if (web?.getRandomValues) return web.getRandomValues(out);
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

export async function randomSalt(): Promise<string> {
  return Array.from(await randomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
}

export const hashPin = (pin: string, salt: string): Promise<string> =>
  sha256Hex(`kinetic-lock:${salt}:${pin}`);
