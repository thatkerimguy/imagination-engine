import { createId } from '@ie/core';
import { OsuError, parseOsu, readZip, type OsuChart, type ZipEntry } from '@ie/rhythm';

/*
 * Opens chart files picked in the Studio: single .osu charts, or .osz archives holding several
 * difficulties and their song. The song comes along when the archive (or the files picked with
 * the chart) has it.
 */

export interface ChartSet {
  readonly charts: readonly OsuChart[];
  /** The song the charts play, when it was found. */
  readonly audio: File | null;
  /** Charts that couldn't be read (other game modes, broken files). */
  readonly skipped: number;
}

const AUDIO_TYPES: Readonly<Record<string, string>> = {
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
};

const ext = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '';
const base = (name: string) => name.split(/[\\/]/).pop() ?? name;
const same = (a: string, b: string) => base(a).toLowerCase() === base(b).toLowerCase();

function parse(text: string): OsuChart | null {
  try {
    return parseOsu(text, () => createId('n'), createId('bm'));
  } catch (error) {
    if (error instanceof OsuError) return null;
    throw error;
  }
}

async function fromArchive(
  entries: readonly ZipEntry[],
): Promise<{ charts: OsuChart[]; audio: File | null; skipped: number }> {
  const charts: OsuChart[] = [];
  let skipped = 0;
  const decoder = new TextDecoder('utf-8');
  for (const entry of entries.filter((e) => ext(e.name) === 'osu').sort((a, b) => a.name.localeCompare(b.name))) {
    const chart = parse(decoder.decode(await entry.read()));
    if (chart) charts.push(chart);
    else skipped++;
  }
  const wanted = charts[0]?.audioFile;
  const song =
    (wanted ? entries.find((e) => same(e.name, wanted)) : undefined) ??
    entries.find((e) => ext(e.name) in AUDIO_TYPES);
  const audio = song
    ? new File([await song.read()], base(song.name), { type: AUDIO_TYPES[ext(song.name)] ?? '' })
    : null;
  return { charts, audio, skipped };
}

export async function readChartFiles(files: readonly File[]): Promise<ChartSet> {
  const charts: OsuChart[] = [];
  let audio: File | null = null;
  let skipped = 0;
  for (const file of files) {
    const kind = ext(file.name);
    if (kind === 'osz' || kind === 'zip') {
      const set = await fromArchive(readZip(new Uint8Array(await file.arrayBuffer())));
      charts.push(...set.charts);
      audio ??= set.audio;
      skipped += set.skipped;
    } else if (kind === 'osu') {
      const chart = parse(await file.text());
      if (chart) charts.push(chart);
      else skipped++;
    }
  }
  // A song picked beside a single chart.
  if (!audio) {
    const wanted = charts[0]?.audioFile;
    audio =
      files.find((f) => wanted && same(f.name, wanted)) ??
      files.find((f) => ext(f.name) in AUDIO_TYPES) ??
      null;
  }
  return { charts, audio, skipped };
}
