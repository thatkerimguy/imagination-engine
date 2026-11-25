// Pure ELF program-header reader for the Android 16 KB page-size gate (DIRECTIVE-01).
// Google Play requires every PT_LOAD segment of a 64-bit `.so` to be aligned to >= 16 KB
// (p_align >= 0x4000). No `readelf` needed: this reads the header bytes directly.

export const PAGE_16K = 0x4000;
export const PT_LOAD = 1;

const ELF_MAGIC = [0x7f, 0x45, 0x4c, 0x46]; // \x7FELF
const ELFCLASS32 = 1;
const ELFCLASS64 = 2;
const ELFDATA2LSB = 1;
const ELFDATA2MSB = 2;

/**
 * @typedef {{ offset: number, vaddr: number, align: number }} LoadSegment
 * @typedef {{ elfClass: 32 | 64, machine: number, loads: LoadSegment[] }} ElfLoadInfo
 */

/**
 * Reads the PT_LOAD program headers of an ELF image.
 * @param {Uint8Array} bytes
 * @returns {ElfLoadInfo}
 */
export function readElfLoads(bytes) {
  if (bytes.length < 0x34 || ELF_MAGIC.some((b, i) => bytes[i] !== b)) {
    throw new Error('not an ELF file');
  }
  const cls = bytes[4];
  const data = bytes[5];
  if (cls !== ELFCLASS32 && cls !== ELFCLASS64) throw new Error(`bad EI_CLASS ${cls}`);
  if (data !== ELFDATA2LSB && data !== ELFDATA2MSB) throw new Error(`bad EI_DATA ${data}`);
  const le = data === ELFDATA2LSB;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (o) => view.getUint16(o, le);
  const u32 = (o) => view.getUint32(o, le);
  const u64 = (o) => Number(view.getBigUint64(o, le));
  const is64 = cls === ELFCLASS64;
  if (is64 && bytes.length < 0x40) throw new Error('truncated ELF64 header');

  const machine = u16(0x12);
  const phoff = is64 ? u64(0x20) : u32(0x1c);
  const phentsize = u16(is64 ? 0x36 : 0x2a);
  const phnum = u16(is64 ? 0x38 : 0x2c);
  const minEnt = is64 ? 0x38 : 0x20;
  if (phnum > 0 && phentsize < minEnt) throw new Error(`bad e_phentsize ${phentsize}`);
  if (phoff + phnum * phentsize > bytes.length) throw new Error('program headers out of range');

  /** @type {LoadSegment[]} */
  const loads = [];
  for (let i = 0; i < phnum; i++) {
    const p = phoff + i * phentsize;
    if (u32(p) !== PT_LOAD) continue;
    loads.push(
      is64
        ? { offset: u64(p + 0x08), vaddr: u64(p + 0x10), align: u64(p + 0x30) }
        : { offset: u32(p + 0x04), vaddr: u32(p + 0x08), align: u32(p + 0x1c) },
    );
  }
  return { elfClass: is64 ? 64 : 32, machine, loads };
}

/**
 * @typedef {{ status: 'pass' | 'fail' | 'skip', elfClass: 32 | 64 | 0,
 *   minAlign: number, loadCount: number, reason?: string }} AlignVerdict
 */

/**
 * 16 KB verdict for one `.so`: 64-bit images must have every PT_LOAD aligned to >= 16 KB;
 * 32-bit images are reported as skipped (the Play requirement covers 64-bit ABIs only).
 * @param {Uint8Array} bytes
 * @param {number} [minAlign]
 * @returns {AlignVerdict}
 */
export function checkElfAlignment(bytes, minAlign = PAGE_16K) {
  let info;
  try {
    info = readElfLoads(bytes);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return { status: 'fail', elfClass: 0, minAlign: 0, loadCount: 0, reason };
  }
  const aligns = info.loads.map((l) => l.align);
  const min = aligns.length ? Math.min(...aligns) : 0;
  const base = { elfClass: info.elfClass, minAlign: min, loadCount: info.loads.length };
  if (info.elfClass === 32) return { status: 'skip', ...base, reason: '32-bit ABI' };
  if (!aligns.length) return { status: 'fail', ...base, reason: 'no PT_LOAD segments' };
  if (min < minAlign) return { status: 'fail', ...base, reason: `p_align 0x${min.toString(16)}` };
  return { status: 'pass', ...base };
}

/** @param {number} n */
export function hex(n) {
  return `0x${n.toString(16)}`;
}
