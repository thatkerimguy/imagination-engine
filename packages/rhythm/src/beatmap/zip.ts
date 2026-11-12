/*
 * Just enough of the zip format to open a chart archive (.osz): the central directory, stored and
 * deflated entries, UTF-8 names. Inflating uses the browser's DecompressionStream, so nothing is
 * bundled for it.
 */

export interface ZipEntry {
  readonly name: string;
  readonly size: number;
  read(): Promise<Uint8Array<ArrayBuffer>>;
}

const END_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

export class ZipError extends Error {}

async function inflate(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function readZip(bytes: Uint8Array<ArrayBuffer>): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  // The end record sits in the last 64 KiB (its comment can be that long).
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === END_SIGNATURE) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new ZipError('Not a zip archive.');
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const utf8 = new TextDecoder('utf-8');
  const entries: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== CENTRAL_SIGNATURE)
      throw new ZipError('The archive is damaged.');
    const method = view.getUint16(at + 10, true);
    const compressed = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = utf8.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith('/')) continue;
    entries.push({
      name,
      size,
      async read() {
        if (local + 30 > bytes.length || view.getUint32(local, true) !== LOCAL_SIGNATURE)
          throw new ZipError('The archive is damaged.');
        const start =
          local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
        const data = bytes.slice(start, start + compressed);
        if (method === 0) return data;
        if (method === 8) return inflate(data);
        throw new ZipError(`Entries packed with method ${method} can't be opened.`);
      },
    });
  }
  return entries;
}
