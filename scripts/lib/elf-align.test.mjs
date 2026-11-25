import { describe, expect, it } from 'vitest';
import { checkElfAlignment, PAGE_16K, readElfLoads } from './elf-align.mjs';

const EM_AARCH64 = 183;

/**
 * Tiny synthetic ELF: a valid header plus one program header per entry in `segments`.
 * @param {{ cls?: 32 | 64, segments: { type: number, align: number }[] }} spec
 */
function makeElf({ cls = 64, segments }) {
  const is64 = cls === 64;
  const ehsize = is64 ? 0x40 : 0x34;
  const phentsize = is64 ? 0x38 : 0x20;
  const buf = new Uint8Array(ehsize + phentsize * segments.length);
  const v = new DataView(buf.buffer);
  buf.set([0x7f, 0x45, 0x4c, 0x46, is64 ? 2 : 1, 1, 1]);
  v.setUint16(0x10, 3, true); // ET_DYN
  v.setUint16(0x12, EM_AARCH64, true);
  if (is64) {
    v.setBigUint64(0x20, BigInt(ehsize), true);
    v.setUint16(0x36, phentsize, true);
    v.setUint16(0x38, segments.length, true);
  } else {
    v.setUint32(0x1c, ehsize, true);
    v.setUint16(0x2a, phentsize, true);
    v.setUint16(0x2c, segments.length, true);
  }
  segments.forEach((s, i) => {
    const p = ehsize + i * phentsize;
    v.setUint32(p, s.type, true);
    if (is64) {
      v.setBigUint64(p + 0x10, BigInt(i * s.align), true);
      v.setBigUint64(p + 0x30, BigInt(s.align), true);
    } else {
      v.setUint32(p + 0x08, i * s.align, true);
      v.setUint32(p + 0x1c, s.align, true);
    }
  });
  return buf;
}

describe('readElfLoads', () => {
  it('reads only PT_LOAD headers of a 64-bit image', () => {
    const elf = makeElf({
      segments: [
        { type: 6, align: 8 }, // PT_PHDR
        { type: 1, align: PAGE_16K },
        { type: 1, align: PAGE_16K },
        { type: 2, align: 8 }, // PT_DYNAMIC
      ],
    });
    const info = readElfLoads(elf);
    expect(info.elfClass).toBe(64);
    expect(info.machine).toBe(EM_AARCH64);
    expect(info.loads.map((l) => l.align)).toEqual([PAGE_16K, PAGE_16K]);
  });

  it('rejects non-ELF and truncated program headers', () => {
    expect(() => readElfLoads(new Uint8Array(64))).toThrow('not an ELF file');
    const elf = makeElf({ segments: [{ type: 1, align: PAGE_16K }] });
    expect(() => readElfLoads(elf.subarray(0, 0x50))).toThrow('out of range');
  });
});

describe('checkElfAlignment', () => {
  it('passes a 64-bit image whose PT_LOADs are all 16 KB aligned', () => {
    const elf = makeElf({
      segments: [
        { type: 1, align: 0x4000 },
        { type: 1, align: 0x10000 },
      ],
    });
    expect(checkElfAlignment(elf)).toEqual({
      status: 'pass',
      elfClass: 64,
      minAlign: 0x4000,
      loadCount: 2,
    });
  });

  it('fails a 64-bit image with any 4 KB PT_LOAD', () => {
    const elf = makeElf({
      segments: [
        { type: 1, align: 0x4000 },
        { type: 1, align: 0x1000 },
      ],
    });
    const verdict = checkElfAlignment(elf);
    expect(verdict.status).toBe('fail');
    expect(verdict.minAlign).toBe(0x1000);
    expect(verdict.reason).toBe('p_align 0x1000');
  });

  it('fails images with no PT_LOAD or an unreadable header', () => {
    expect(checkElfAlignment(makeElf({ segments: [{ type: 2, align: 8 }] })).reason).toBe(
      'no PT_LOAD segments',
    );
    expect(checkElfAlignment(new Uint8Array([1, 2, 3])).status).toBe('fail');
  });

  it('skips 32-bit images (16 KB rule covers 64-bit ABIs)', () => {
    const elf = makeElf({ cls: 32, segments: [{ type: 1, align: 0x1000 }] });
    expect(checkElfAlignment(elf)).toMatchObject({
      status: 'skip',
      elfClass: 32,
      minAlign: 0x1000,
    });
  });
});
