import { DEMUCS_FILES, StemSeparator, type StemModelSource } from '@ie/audio';
import StemsWorker from '@ie/audio/stems-worker?worker';
import type { Track } from '@ie/story';
import { create } from 'zustand';
import { useProject } from '../project/store.ts';
import { createModelStore } from './model-store.ts';
import { trackBytes, updateTrack } from './studio-audio.ts';

/*
 * Stem separation (ADR 0028): an opt-in model (about 180 MB) that splits a song so its drum hits
 * can be found. Desktop work: the hits are saved with the track's analysis and travel with the
 * novel, so phones never separate anything.
 */

export const stemModel = createModelStore('models/demucs', DEMUCS_FILES);

const source: StemModelSource = {
  available: stemModel.available,
  async load() {
    const [onnx] = await stemModel.read();
    if (!onnx) throw new Error('The stem model is missing.');
    return onnx;
  },
};

let separator: StemSeparator | null = null;

/** Running and failed separations by track ID (not part of the document). */
export const useStems = create<{
  readonly jobs: Readonly<Record<string, { fraction: number } | { error: string }>>;
}>()(() => ({ jobs: {} }));

function setJob(id: string, job: { fraction: number } | { error: string } | null): void {
  const jobs = { ...useStems.getState().jobs };
  if (job) jobs[id] = job;
  else delete jobs[id];
  useStems.setState({ jobs });
}

/** Tracks whose drum hits can be found: analysed, readable, and without hits yet. */
export function tracksWithoutDrums(tracks: readonly Track[]): Track[] {
  return tracks.filter(
    (t) => (t.source.kind === 'file' || t.source.kind === 'url') && t.analysis && !t.analysis.drums,
  );
}

export async function findDrumHits(id: string): Promise<void> {
  const track = useProject.getState().history?.present.audio?.tracks.find((t) => t.id === id);
  if (!track?.analysis || 'fraction' in (useStems.getState().jobs[id] ?? {})) return;
  setJob(id, { fraction: 0 });
  try {
    const bytes = await trackBytes(track);
    if (!bytes) return setJob(id, null);
    separator ??= new StemSeparator(() => new StemsWorker(), source);
    const drums = await separator.drumHits(bytes, (fraction) => setJob(id, { fraction }));
    updateTrack(id, (t) => (t.analysis ? { ...t, analysis: { ...t.analysis, drums } } : t));
    setJob(id, null);
  } catch (error) {
    console.warn(error);
    setJob(id, { error: error instanceof Error ? error.message : String(error) });
  }
}

/** One song at a time: each holds a whole decoded song and the network in memory. */
export async function findAllDrumHits(): Promise<void> {
  const tracks = useProject.getState().history?.present.audio?.tracks ?? [];
  for (const track of tracksWithoutDrums(tracks)) await findDrumHits(track.id);
}
