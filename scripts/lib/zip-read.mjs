// Minimal read-only ZIP reader (APK / AAB) on Node built-ins: central directory + stored or
// deflated entries. No ZIP64 (Play caps base modules far below 4 GB).
import { inflateRawSync } from 'node:zlib';

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

/**
 * @typedef {{ name: string, method: number, compressedSize: number, size: number,
 *   localHeaderOffset: number }} ZipEntry
 */

/**
 * @param {Buffer} zip
 * @returns {ZipEntry[]}
 */
export function listZipEntries(zip) {
  const minEocd = 22;
  const stop = Math.max(0, zip.length - minEocd - 0xffff);
  let eocd = -1;
  for (let i = zip.length - minEocd; i >= stop; i--) {
    if (zip.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a ZIP archive (no end-of-central-directory record)');
  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  /** @type {ZipEntry[]} */
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(p) !== CEN_SIG) throw new Error(`bad central directory entry ${i}`);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    entries.push({
      name: zip.toString('utf8', p + 46, p + 46 + nameLen),
      method: zip.readUInt16LE(p + 10),
      compressedSize: zip.readUInt32LE(p + 20),
      size: zip.readUInt32LE(p + 24),
      localHeaderOffset: zip.readUInt32LE(p + 42),
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/**
 * @param {Buffer} zip
 * @param {ZipEntry} entry
 * @returns {Buffer}
 */
export function readZipEntry(zip, entry) {
  const p = entry.localHeaderOffset;
  if (zip.readUInt32LE(p) !== LOC_SIG) throw new Error(`bad local header for ${entry.name}`);
  const start = p + 30 + zip.readUInt16LE(p + 26) + zip.readUInt16LE(p + 28);
  const raw = zip.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return raw;
  if (entry.method === 8) return inflateRawSync(raw);
  throw new Error(`unsupported compression method ${entry.method} for ${entry.name}`);
}
