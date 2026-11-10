import { create } from 'zustand';
import type { NoteKindChoice } from './labels.ts';
import type { Snap } from './edit.ts';

/** Pixels per beat: the zoom steps. */
export const ZOOMS = [12, 18, 24, 32, 48, 64, 96, 128] as const;

/** What the Sequences workspace has open; not part of the project, so not undone. */
export interface SequencerUi {
  readonly sequenceId: string | null;
  readonly selected: string | null;
  readonly snap: Snap;
  readonly zoom: number;
  /** Where the playhead rests while paused, in beats. */
  readonly playhead: number;
  readonly noteKind: NoteKindChoice;
  open: (sequenceId: string | null) => void;
  select: (id: string | null) => void;
  setSnap: (snap: Snap) => void;
  setZoom: (zoom: number) => void;
  setPlayhead: (beat: number) => void;
  setNoteKind: (kind: NoteKindChoice) => void;
}

export const useSequencerUi = create<SequencerUi>()((set) => ({
  sequenceId: null,
  selected: null,
  snap: 0.25,
  zoom: 32,
  playhead: 0,
  noteKind: 'parry',
  open: (sequenceId) => set({ sequenceId, selected: null, playhead: 0 }),
  select: (selected) => set({ selected }),
  setSnap: (snap) => set({ snap }),
  setZoom: (zoom) => set({ zoom }),
  setPlayhead: (playhead) => set({ playhead }),
  setNoteKind: (noteKind) => set({ noteKind }),
}));
