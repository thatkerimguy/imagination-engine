import { createId } from '@ie/core';
import { OsuError, parseOsu, readZip, type OsuChart, type ZipEntry } from '@ie/rhythm';
import { beatmapSchema } from '@ie/story';

/*
 * Opens chart files picked in the Studio: single .osu charts, or .osz archives holding several
 * difficulties and their song. Each chart keeps the song from its own archive (or picked beside
 * it), so importing several archives at once gives every chart the right music.
 */

export interface ImportedChart {
  readonly chart: OsuChart;
  /** The song this chart plays, when it was found. One File per song, shared by its charts. */
  readonly audio: File | null;
}

export interface ChartSet {
  readonly charts: readonly ImportedChart[];
  /** A song picked on its own, with no chart: it gets a new, empty beatmap. */
  readonly song: File | null;
  /** Charts that couldn't be read (other game modes, broken files, values out of range). */
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
const isAudio = (name: string) => ext(name) in AUDIO_TYPES;

function parse(text: string): OsuChart | null {
  try {
    const chart = parseOsu(text, () => createId('n'), createId('bm'));
    // The chart becomes story data: check it here, at the boundary, so a value out of range
    // never reaches a saved project (which would then fail to load).
    const checked = beatmapSchema.safeParse(chart.beatmap);
    if (checked.success) return chart;
    console.warn('A chart was skipped: its values are out of range.', checked.error);
    return null;
  } catch (error) {
    if (error instanceof OsuError) return null;
    throw error;
  }
}

/** The song a chart names, else the first song there is. */
function songFor<T extends { readonly name: string }>(chart: OsuChart, files: readonly T[]): T | undefined {
  const wanted = chart.audioFile;
  return (wanted ? files.find((f) => same(f.name, wanted)) : undefined) ?? files.find((f) => isAudio(f.name));
}

async function fromArchive(entries: readonly ZipEntry[]): Promise<{ charts: ImportedChart[]; skipped: number }> {
  const charts: ImportedChart[] = [];
  let skipped = 0;
  const decoder = new TextDecoder('utf-8');
  // Each song is read once, however many difficulties play it.
  const songs = new Map<ZipEntry, File>();
  const songFile = async (entry: ZipEntry | undefined): Promise<File | null> => {
    if (!entry) return null;
    let file = songs.get(entry);
    if (!file) {
      file = new File([await entry.read()], base(entry.name), { type: AUDIO_TYPES[ext(entry.name)] ?? '' });
      songs.set(entry, file);
    }
    return file;
  };
  const sorted = entries.filter((e) => ext(e.name) === 'osu').sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of sorted) {
    const chart = parse(decoder.decode(await entry.read()));
    if (!chart) {
      skipped++;
      continue;
    }
    charts.push({ chart, audio: await songFile(songFor(chart, entries)) });
  }
  return { charts, skipped };
}

export async function readChartFiles(files: readonly File[]): Promise<ChartSet> {
  const charts: ImportedChart[] = [];
  let skipped = 0;
  const loose = files.filter((f) => isAudio(f.name));
  for (const file of files) {
    const kind = ext(file.name);
    if (kind === 'osz' || kind === 'zip') {
      const set = await fromArchive(readZip(new Uint8Array(await file.arrayBuffer())));
      charts.push(...set.charts);
      skipped += set.skipped;
    } else if (kind === 'osu') {
      const chart = parse(await file.text());
      // A single chart plays a song picked beside it.
      if (chart) charts.push({ chart, audio: songFor(chart, loose) ?? null });
      else skipped++;
    }
  }
  return { charts, song: charts.length === 0 ? (loose[0] ?? null) : null, skipped };
}
