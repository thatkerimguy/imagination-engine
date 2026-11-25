// Explicit-header ZIP writer for archives that need STORE entries (EPUB's OCF `mimetype`).
// Every local header carries the exact CRC-32 and sizes (no data descriptors) and zero extra
// fields, so entry #0 sits at byte offset 0 exactly as the OCF spec requires. Deflated entries
// are compressed one at a time, yielding between large entries so the UI thread stays responsive.
// Pure (no platform imports).
import { deflateSync } from 'fflate';

export interface WriteEntry {
  name: string;
  data: Uint8Array;
  /** Compression method 0 (STORE) instead of 8 (DEFLATE). */
  store: boolean;
}

const CRC_TABLE = ((): Uint32Array => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS time/date words for a fixed, valid timestamp (reproducible archives). */
const DOS_TIME = 0;
const DOS_DATE = ((2024 - 1980) << 9) | (1 << 5) | 1;
const YIELD_ABOVE = 64 * 1024;

const yieldTick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

interface Packed {
  name: Uint8Array;
  body: Uint8Array;
  crc: number;
  size: number;
  method: 0 | 8;
  offset: number;
}

function localHeader(p: Packed): Uint8Array {
  const h = new Uint8Array(30 + p.name.length);
  const v = new DataView(h.buffer);
  v.setUint32(0, 0x04034b50, true);
  v.setUint16(4, 20, true); // version needed
  v.setUint16(6, 0, true); // flags: no data descriptor
  v.setUint16(8, p.method, true);
  v.setUint16(10, DOS_TIME, true);
  v.setUint16(12, DOS_DATE, true);
  v.setUint32(14, p.crc, true);
  v.setUint32(18, p.body.length, true);
  v.setUint32(22, p.size, true);
  v.setUint16(26, p.name.length, true);
  v.setUint16(28, 0, true); // extra field length
  h.set(p.name, 30);
  return h;
}

function centralHeader(p: Packed): Uint8Array {
  const h = new Uint8Array(46 + p.name.length);
  const v = new DataView(h.buffer);
  v.setUint32(0, 0x02014b50, true);
  v.setUint16(4, 20, true); // version made by
  v.setUint16(6, 20, true); // version needed
  v.setUint16(8, 0, true);
  v.setUint16(10, p.method, true);
  v.setUint16(12, DOS_TIME, true);
  v.setUint16(14, DOS_DATE, true);
  v.setUint32(16, p.crc, true);
  v.setUint32(20, p.body.length, true);
  v.setUint32(24, p.size, true);
  v.setUint16(28, p.name.length, true);
  // extra (30), comment (32), disk (34), internal attrs (36), external attrs (38) all zero
  v.setUint32(42, p.offset, true);
  h.set(p.name, 46);
  return h;
}

function endRecord(count: number, cdSize: number, cdOffset: number): Uint8Array {
  const h = new Uint8Array(22);
  const v = new DataView(h.buffer);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(8, count, true);
  v.setUint16(10, count, true);
  v.setUint32(12, cdSize, true);
  v.setUint32(16, cdOffset, true);
  return h;
}

/** Writes `entries` in order. */
export async function writeZip(entries: readonly WriteEntry[]): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const packed: Packed[] = [];
  let offset = 0;
  for (const e of entries) {
    if (e.data.length > YIELD_ABOVE) await yieldTick();
    const body = e.store ? e.data : deflateSync(e.data, { level: 6 });
    const p: Packed = {
      name: enc.encode(e.name),
      body,
      crc: crc32(e.data),
      size: e.data.length,
      method: e.store ? 0 : 8,
      offset,
    };
    packed.push(p);
    offset += 30 + p.name.length + body.length;
  }
  const central = packed.map(centralHeader);
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(offset + cdSize + 22);
  let at = 0;
  for (const p of packed) {
    const h = localHeader(p);
    out.set(h, at);
    out.set(p.body, at + h.length);
    at += h.length + p.body.length;
  }
  for (const c of central) {
    out.set(c, at);
    at += c.length;
  }
  out.set(endRecord(packed.length, cdSize, offset), at);
  return out;
}
