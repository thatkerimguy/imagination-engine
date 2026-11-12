/** A small original chart in .osu text form, for tests and the Studio's e2e import. */
export const SAMPLE_OSU = `osu file format v14

[General]
AudioFilename: song.mp3
AudioLeadIn: 500
PreviewTime: 1000
Mode: 0

[Metadata]
Title:Lantern Steps
TitleUnicode:Lantern Steps
Artist:Nobody
ArtistUnicode:Nobody
Creator:Tester
Version:Easy
Source:

[Difficulty]
HPDrainRate:4
CircleSize:4
OverallDifficulty:5
ApproachRate:6
SliderMultiplier:1.4
SliderTickRate:1

[Events]
//Background and Video events
0,0,"bg.jpg",0,0

[TimingPoints]
1000,500,4,2,0,60,1,0
3000,-50,4,2,0,60,0,0

[HitObjects]
256,192,1000,5,0,0:0:0:0:
356,192,1500,1,0,0:0:0:0:
100,100,2000,2,0,L|240:100,1,140
200,300,3000,6,0,B|300:300|300:200,2,140
256,192,5000,12,0,7000,0:0:0:0:
256,192,7500,5,0,0:0:0:0:
`;

export interface RawZipEntry {
  readonly name: string;
  readonly data: Uint8Array;
  readonly method: number;
  readonly size: number;
}

/** A minimal zip writer for tests (no CRCs: the reader doesn't check them). */
export function buildZip(entries: readonly RawZipEntry[]): Uint8Array<ArrayBuffer> {
  const parts: number[] = [];
  const central: number[] = [];
  const u16 = (out: number[], v: number) => out.push(v & 0xff, (v >> 8) & 0xff);
  const u32 = (out: number[], v: number) =>
    out.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);
  for (const e of entries) {
    const name = new TextEncoder().encode(e.name);
    const offset = parts.length;
    u32(parts, 0x04034b50);
    u16(parts, 20);
    u16(parts, 0x800);
    u16(parts, e.method);
    u32(parts, 0);
    u32(parts, 0);
    u32(parts, e.data.length);
    u32(parts, e.size);
    u16(parts, name.length);
    u16(parts, 0);
    parts.push(...name, ...e.data);
    u32(central, 0x02014b50);
    u16(central, 20);
    u16(central, 20);
    u16(central, 0x800);
    u16(central, e.method);
    u32(central, 0);
    u32(central, 0);
    u32(central, e.data.length);
    u32(central, e.size);
    u16(central, name.length);
    u16(central, 0);
    u16(central, 0);
    u16(central, 0);
    u16(central, 0);
    u32(central, 0);
    u32(central, offset);
    central.push(...name);
  }
  const start = parts.length;
  const end: number[] = [];
  u32(end, 0x06054b50);
  u16(end, 0);
  u16(end, 0);
  u16(end, entries.length);
  u16(end, entries.length);
  u32(end, central.length);
  u32(end, start);
  u16(end, 0);
  return new Uint8Array([...parts, ...central, ...end]);
}
