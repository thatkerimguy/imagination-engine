import type { Locale } from '@ie/i18n';
import type { StoryProject } from '@ie/story';
import { readPref, writePref } from '@ie/ui-kit';
import { create } from 'zustand';
import { newProject } from './factory.ts';
import { createHistory, record, redo, undo, type History } from './history.ts';
import {
  deleteProject,
  listProjects,
  projectStore,
  readProject,
  unsaveable,
  writeProject,
} from './storage.ts';
import { allPassages } from './tree.ts';

const LAST_PROJECT = 'ie.studio.project';
const SAVE_DELAY_MS = 500;

/** `invalid`: the open project breaks its schema, so the last good copy is kept instead. */
export type SaveState = 'saved' | 'pending' | 'error' | 'invalid';

export interface ProjectState {
  readonly history: History<StoryProject> | null;
  /** The passage open in Write. */
  readonly passageId: string | null;
  /** A block or passage to scroll to and highlight once (from Problems or Flow). */
  readonly reveal: string | null;
  /** Where Play starts: a passage ("Play from here") or null for the story's start. */
  readonly playFrom: string | null;
  /** The language being written in Manuscript (independent of the Studio's own language). */
  readonly writeLocale: Locale | null;
  readonly saveState: SaveState;
  edit: (change: (doc: StoryProject) => StoryProject, mergeKey?: string) => void;
  undo: () => void;
  redo: () => void;
  openPassage: (id: string, reveal?: string) => void;
  clearReveal: () => void;
  setPlayFrom: (passageId: string | null) => void;
  setWriteLocale: (locale: Locale) => void;
  /** Replaces the open project (new, opened, imported). */
  load: (doc: StoryProject) => void;
}

export const useProject = create<ProjectState>()((set, get) => ({
  history: null,
  passageId: null,
  reveal: null,
  playFrom: null,
  writeLocale: null,
  saveState: 'saved',
  edit: (change, mergeKey) => {
    const { history } = get();
    if (!history) return;
    const next = change(history.present);
    if (next === history.present) return;
    set({ history: record(history, next, mergeKey ?? null, Date.now()) });
  },
  undo: () => {
    const { history } = get();
    if (history) set({ history: undo(history) });
  },
  redo: () => {
    const { history } = get();
    if (history) set({ history: redo(history) });
  },
  openPassage: (passageId, reveal) => set({ passageId, reveal: reveal ?? null }),
  clearReveal: () => set({ reveal: null }),
  setPlayFrom: (playFrom) => set({ playFrom }),
  setWriteLocale: (writeLocale) => set({ writeLocale }),
  load: (doc) => {
    writePref(LAST_PROJECT, doc.id);
    set({
      history: createHistory(doc),
      passageId: doc.start,
      reveal: null,
      playFrom: null,
      saveState: 'saved',
    });
  },
}));

/** The open project. Only call inside the editor, which renders once a project is loaded. */
export function useDoc(): StoryProject {
  const doc = useProject((s) => s.history?.present);
  if (!doc) throw new Error('No project is open.');
  return doc;
}

/** The passage open in Write, falling back to the start (a removed passage, a fresh project). */
export function currentPassageId(doc: StoryProject, passageId: string | null): string {
  const passages = allPassages(doc);
  return passages.some((p) => p.id === passageId)
    ? (passageId as string)
    : ((passages.find((p) => p.id === doc.start) ?? passages[0])?.id ?? doc.start);
}

// --- persistence ---------------------------------------------------------------------------

let timer: ReturnType<typeof setTimeout> | undefined;
let saved: StoryProject | null = null;

async function save(): Promise<void> {
  timer = undefined;
  const doc = useProject.getState().history?.present;
  if (!doc || doc === saved) return;
  // Every editor guards its own limits; this is the last line, so one missed guard can't lose
  // the novel. Undoing the change makes the project saveable again.
  const problem = unsaveable(doc);
  if (problem) {
    console.warn(`The project breaks its schema and was not saved: ${problem}`);
    useProject.setState({ saveState: 'invalid' });
    return;
  }
  try {
    await writeProject(await projectStore(), doc);
    saved = doc;
    if (useProject.getState().history?.present === doc) useProject.setState({ saveState: 'saved' });
  } catch (error) {
    console.error(error);
    useProject.setState({ saveState: 'error' });
  }
}

/** Opens the last project (or the newest, or a new one) and autosaves every change after that. */
export async function startProjects(
  untitled: { en: string; tr: string },
  startName: string,
): Promise<void> {
  const store = await projectStore();
  const last = readPref(LAST_PROJECT);
  let doc = last ? await readProject(store, last) : null;
  if (!doc) {
    const [newest] = await listProjects(store);
    doc = newest ? await readProject(store, newest.id) : null;
  }
  if (!doc) {
    doc = newProject(untitled, startName);
    await writeProject(store, doc);
  }
  saved = doc;
  useProject.getState().load(doc);

  useProject.subscribe((state, previous) => {
    const doc = state.history?.present;
    if (!doc || doc === previous.history?.present || doc === saved) return;
    if (state.saveState !== 'pending') useProject.setState({ saveState: 'pending' });
    clearTimeout(timer);
    timer = setTimeout(() => void save(), SAVE_DELAY_MS);
  });
  // Start the write while the page is still alive; a write begun at unload may be aborted.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer !== undefined) {
      clearTimeout(timer);
      void save();
    }
  });
}

/** Saves any pending change now (before switching projects or exporting). */
export async function flushSave(): Promise<void> {
  if (timer !== undefined) clearTimeout(timer);
  await save();
}

export async function openProject(id: string): Promise<boolean> {
  await flushSave();
  const doc = await readProject(await projectStore(), id);
  if (!doc) return false;
  saved = doc;
  useProject.getState().load(doc);
  return true;
}

/** Saves and opens a project document (a new one, or one imported from a file). */
export async function adoptProject(doc: StoryProject): Promise<void> {
  await flushSave();
  await writeProject(await projectStore(), doc);
  saved = doc;
  useProject.getState().load(doc);
}

export async function removeProject(id: string): Promise<void> {
  await deleteProject(await projectStore(), id);
}
