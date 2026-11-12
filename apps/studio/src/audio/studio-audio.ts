import {
  AnalysisCache,
  Analyzer,
  BEAT_THIS_TRACKER,
  DSP_TRACKER,
  AudioDirector,
  AudioEngine,
  fetchAudioBytes,
  type AnalysisProgress,
} from '@ie/audio';
import AnalysisWorker from '@ie/audio/analysis-worker?worker';
import { createId } from '@ie/core';
import type { AudioLibrary, StoryProject, Track } from '@ie/story';
import { create } from 'zustand';
import { projectStore } from '../project/storage.ts';
import { useProject } from '../project/store.ts';
import { beatThisSource } from './beat-this-model.ts';
import { audioFiles } from './studio-audio-files.ts';

export { audioFiles };

/*
 * The Studio's sound: one engine and director for previews and Play, imported files in OPFS, and
 * beat analysis in a worker with results cached by content (ADR 0012).
 */

const doc = (): StoryProject | undefined => useProject.getState().history?.present;

const objectUrls = new Map<string, string>();

async function resolveTrack(track: Track): Promise<string | null> {
  const source = track.source;
  if (source.kind === 'url') return source.url;
  if (source.kind !== 'file') return null;
  const cached = objectUrls.get(source.path);
  if (cached) return cached;
  const blob = await (await audioFiles()).read(source.path);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  objectUrls.set(source.path, url);
  return url;
}

export const engine = new AudioEngine();
engine.unlockOnGesture();

export const director = new AudioDirector({
  engine,
  resolve: resolveTrack,
  library: () => doc()?.audio,
  characters: () => doc()?.characters ?? [],
});

/** The same-origin relay for catalogue hosts that send no CORS headers (dev and preview). */
const relay = (url: string) => `/fetch?url=${encodeURIComponent(url)}`;

/** The track's raw audio, or null for sources that only stream (Spotify, YouTube). */
export async function trackBytes(track: Track): Promise<ArrayBuffer | null> {
  const source = track.source;
  if (source.kind === 'file') {
    const blob = await (await audioFiles()).read(source.path);
    if (!blob) throw new Error('missing-file');
    return blob.arrayBuffer();
  }
  if (source.kind === 'url') return fetchAudioBytes(source.url, relay);
  return null;
}

let analyzer: Promise<Analyzer> | null = null;
function getAnalyzer(): Promise<Analyzer> {
  analyzer ??= projectStore().then(
    (store) => new Analyzer(() => new AnalysisWorker(), new AnalysisCache(store), beatThisSource),
  );
  return analyzer;
}

export type AnalysisJob =
  { readonly stage: AnalysisProgress; readonly fraction?: number } | { readonly error: string };

/**
 * Running and failed analyses by track ID, and why Beat This! was passed over for a track (not
 * part of the document, so not undoable).
 */
export const useAnalysis = create<{
  readonly jobs: Readonly<Record<string, AnalysisJob>>;
  readonly fallbacks: Readonly<Record<string, string>>;
}>()(() => ({ jobs: {}, fallbacks: {} }));

/** The tracker a new analysis uses on this device: Beat This! once its model is downloaded. */
export const bestTracker = (): string =>
  beatThisSource.available() ? BEAT_THIS_TRACKER : DSP_TRACKER;

function setJob(id: string, job: AnalysisJob | null): void {
  const jobs = { ...useAnalysis.getState().jobs };
  if (job) jobs[id] = job;
  else delete jobs[id];
  useAnalysis.setState({ jobs });
}

const EMPTY: AudioLibrary = { tracks: [], sounds: [] };

/** An undoable change to the novel's audio library. */
export function editAudio(
  change: (library: AudioLibrary) => AudioLibrary,
  mergeKey?: string,
): void {
  useProject.getState().edit((d) => ({ ...d, audio: change(d.audio ?? EMPTY) }), mergeKey);
}

export function updateTrack(id: string, change: (track: Track) => Track, mergeKey?: string): void {
  editAudio(
    (lib) => ({ ...lib, tracks: lib.tracks.map((t) => (t.id === id ? change(t) : t)) }),
    mergeKey,
  );
}

/** Finds beats, downbeats, key and sections; runs on its own for every new file or catalogue song. */
export async function analyzeTrack(id: string): Promise<void> {
  const track = doc()?.audio?.tracks.find((t) => t.id === id);
  if (!track || 'stage' in (useAnalysis.getState().jobs[id] ?? {})) return;
  setJob(id, { stage: 'decoding' });
  try {
    const bytes = await trackBytes(track);
    if (!bytes) return setJob(id, null);
    const { analysis, fallback } = await (
      await getAnalyzer()
    ).analyze(bytes, (stage, fraction) =>
      setJob(id, { stage, ...(fraction === undefined ? {} : { fraction }) }),
    );
    // Saved as its own step, so Undo after an import removes the analysis before the track.
    updateTrack(id, (t) => ({ ...t, analysis }));
    const fallbacks = { ...useAnalysis.getState().fallbacks };
    if (fallback) fallbacks[id] = fallback;
    else delete fallbacks[id];
    useAnalysis.setState({ fallbacks });
    setJob(id, null);
  } catch (error) {
    console.warn(error);
    setJob(id, { error: error instanceof Error ? error.message : String(error) });
  }
}

/** Tracks whose beats could be better: never analysed, or analysed by a weaker tracker. */
export function tracksToPrepare(tracks: readonly Track[]): Track[] {
  const best = bestTracker();
  return tracks.filter(
    (t) => (t.source.kind === 'file' || t.source.kind === 'url') && t.analysis?.tracker !== best,
  );
}

/**
 * Analyses every track that could do better, one at a time (each decodes a whole song). Done on
 * a desktop, the results travel with the novel, so phones never analyse (ADR 0014).
 */
export async function prepareAllTracks(): Promise<void> {
  for (const track of tracksToPrepare(doc()?.audio?.tracks ?? [])) await analyzeTrack(track.id);
}

/** Adds a track to the library and analyses it if its audio can be read. */
export function addTrack(track: Track): void {
  editAudio((lib) => ({ ...lib, tracks: [...lib.tracks, track] }));
  if (track.source.kind === 'file' || track.source.kind === 'url') void analyzeTrack(track.id);
}

/** Copies an audio file into the Studio's storage and adds it as a track the author owns. */
/**
 * Stores an audio file and adds it as a track. A song that came with someone else's chart isn't
 * the author's own, so `own: false` leaves its licence unknown until they say.
 */
export async function importAudioFile(
  file: File,
  info: { readonly title?: string; readonly artist?: string; readonly own?: boolean } = {},
): Promise<Track> {
  const id = createId('t');
  const ext = /\.([a-z0-9]{1,5})$/i.exec(file.name)?.[1]?.toLowerCase() ?? 'audio';
  const path = `audio/${id}.${ext}`;
  await (await audioFiles()).write(path, file);
  const track: Track = {
    id,
    title: info.title || file.name.replace(/\.[^.]+$/, ''),
    ...(info.artist ? { artist: info.artist } : {}),
    source: { kind: 'file', path, ...(file.type ? { mime: file.type } : {}) },
    ...(info.own === false ? {} : { license: { code: 'own' } }),
  };
  addTrack(track);
  return track;
}

/** Removes a track. Its stored file stays, so Undo can bring the track back whole. */
export function removeTrack(track: Track): void {
  if (director.music.trackId === track.id) director.music.stop(0.2);
  editAudio((lib) => ({ ...lib, tracks: lib.tracks.filter((t) => t.id !== track.id) }));
  if (track.source.kind !== 'file') return;
  const url = objectUrls.get(track.source.path);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(track.source.path);
}
