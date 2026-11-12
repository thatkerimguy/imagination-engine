import { merge3 } from '@ie/core';
import { storyProjectSchema, type StoryProject } from '@ie/story';
import { readPref, writePref } from '@ie/ui-kit';
import { z } from 'zod';
import { create } from 'zustand';
import { projectStore, writeProject } from '../project/storage.ts';
import { useProject } from '../project/store.ts';
import { audioFiles } from '../audio/studio-audio-files.ts';
import { syncOnce, type SyncKind } from './engine.ts';
import { httpFileRemote, syncAudioFiles, type FileRemote, type KnownFiles } from './files.ts';
import { httpRemote, SyncUnavailable, type RemoteSummary, type SyncRemote } from './remote.ts';

/*
 * Device sync in the Studio (ADR 0024): when turned on, the open story syncs on start, when the tab
 * comes back into view or goes out of it, and every couple of minutes while it is in view.
 */

const PREF = 'ie.studio.sync';
const EVERY_MS = 2 * 60_000;
const baseKey = (id: string) => `sync:${id}`;
const baseSchema = z.object({ v: z.literal(1), doc: storyProjectSchema });

export type SyncState = 'off' | 'idle' | 'syncing' | 'unavailable' | 'error';

export interface SyncStatus {
  readonly enabled: boolean;
  readonly state: SyncState;
  readonly lastSync: number | null;
  readonly lastKind: SyncKind | null;
  readonly conflicts: number;
  /** Stories in the store that this device doesn't have yet. */
  readonly elsewhere: readonly RemoteSummary[];
  /** Songs the open story plays that no device has synced yet. */
  readonly missingSongs: number;
}

export const useSync = create<SyncStatus>()(() => ({
  enabled: readPref(PREF) === 'on',
  state: readPref(PREF) === 'on' ? 'idle' : 'off',
  lastSync: null,
  lastKind: null,
  conflicts: 0,
  elsewhere: [],
  missingSongs: 0,
}));

let remote: SyncRemote = httpRemote();
let fileRemote: FileRemote = httpFileRemote();
let running: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | undefined;

/** For tests: a different store. */
export function setSyncRemote(next: SyncRemote, files?: FileRemote): void {
  remote = next;
  if (files) fileRemote = files;
}

/** Files the store is known to hold, kept beside the sync bases. */
const knownFiles: KnownFiles = {
  async has(path) {
    return (await (await projectStore()).get(`syncfile:${path}`)) === true;
  },
  async add(path) {
    await (await projectStore()).set(`syncfile:${path}`, true);
  },
};

/** Moves the open story's songs both ways; a failure here never fails the story's own sync. */
async function syncSongs(doc: StoryProject): Promise<number> {
  try {
    return (await syncAudioFiles(doc, fileRemote, await audioFiles(), knownFiles)).missing;
  } catch (error) {
    if (!(error instanceof SyncUnavailable)) console.warn('Song sync failed.', error);
    return useSync.getState().missingSongs;
  }
}

async function readBase(id: string): Promise<StoryProject | null> {
  const parsed = baseSchema.safeParse(await (await projectStore()).get(baseKey(id)));
  return parsed.success ? parsed.data.doc : null;
}

async function writeBase(doc: StoryProject): Promise<void> {
  await (await projectStore()).set(baseKey(doc.id), { v: 1, doc });
}

async function localIds(): Promise<Set<string>> {
  const keys = await (await projectStore()).keys('project:');
  return new Set(keys.map((k) => k.slice('project:'.length)));
}

async function syncOpen(): Promise<void> {
  const ours = useProject.getState().history?.present;
  if (!ours) return;
  useSync.setState({ state: 'syncing' });
  try {
    const outcome = await syncOnce(remote, ours, await readBase(ours.id));
    await writeBase(outcome.base);
    // The writer may have kept typing during the round trip: merge that on top.
    const current = useProject.getState().history?.present;
    if (current && current.id === ours.id && outcome.doc !== ours) {
      const next = current === ours ? outcome.doc : merge3(ours, current, outcome.doc).value;
      if (next !== current) useProject.getState().edit(() => next);
    }
    const missingSongs = await syncSongs(useProject.getState().history?.present ?? outcome.doc);
    const ids = await localIds();
    const elsewhere = (await remote.list())
      .filter((r) => !ids.has(r.id))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    useSync.setState({
      state: 'idle',
      lastSync: Date.now(),
      lastKind: outcome.kind,
      conflicts: outcome.conflicts.length,
      elsewhere,
      missingSongs,
    });
  } catch (error) {
    useSync.setState({ state: error instanceof SyncUnavailable ? 'unavailable' : 'error' });
    if (!(error instanceof SyncUnavailable)) console.warn('Sync failed.', error);
  }
}

/** Syncs the open story now; a sync already running is joined, not doubled. */
export function syncNow(): Promise<void> {
  if (!useSync.getState().enabled) return Promise.resolve();
  running ??= syncOpen().finally(() => {
    running = null;
  });
  return running;
}

export function setSyncEnabled(enabled: boolean): void {
  writePref(PREF, enabled ? 'on' : 'off');
  useSync.setState({ enabled, state: enabled ? 'idle' : 'off', elsewhere: [] });
  clearInterval(timer);
  timer = undefined;
  if (!enabled) return;
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow();
  }, EVERY_MS);
  void syncNow();
}

/** Opens a story from the store on this device. */
export async function openFromSync(id: string): Promise<void> {
  const copy = await remote.get(id);
  if (!copy) return;
  await writeProject(await projectStore(), copy.doc);
  await writeBase(copy.doc);
  useProject.getState().load(copy.doc);
  useSync.setState((s) => ({ elsewhere: s.elsewhere.filter((r) => r.id !== id) }));
}

/** Called once at start: sync now and on the triggers, if this device has sync on. */
export function startSync(): void {
  document.addEventListener('visibilitychange', () => void syncNow());
  // Opening another story syncs it too.
  useProject.subscribe((state, previous) => {
    if (state.history && state.history.present.id !== previous.history?.present.id) void syncNow();
  });
  if (useSync.getState().enabled) setSyncEnabled(true);
}
