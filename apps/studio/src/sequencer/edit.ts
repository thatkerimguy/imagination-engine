import { createId } from '@ie/core';
import {
  beatsPerBarOf,
  SEQUENCE_LIMITS,
  type ClipTrackKind,
  type Label,
  type MaterialDef,
  type SequenceClip,
  type SequenceDef,
  type SequenceKind,
  type SequenceNote,
  type SequenceNoteKind,
  type SequenceTrack,
  type StoryProject,
  type TrackKind,
} from '@ie/story';
import { newStageBlock, type StageKind } from '../project/stage-kinds.ts';

/*
 * Pure edits on sequences (ADR 0019). The timeline calls these through the project store, so every
 * change is one undoable step (drags merge into one).
 */

/** Snap choices, in beats: a bar (filled in per sequence), a beat, down to a sixteenth. */
export const SNAPS = ['bar', 1, 0.5, 0.25, 0.125, 0.0625] as const;
export type Snap = (typeof SNAPS)[number];

export function snapBeats(snap: Snap, sequence: SequenceDef): number {
  return snap === 'bar' ? beatsPerBarOf(sequence) : snap;
}

/** Rounds to the nearest step, kept inside the sequence. */
export function snapTo(beat: number, step: number, length: number): number {
  const snapped = Math.round(beat / step) * step;
  // Rounded to 1/1000 beat so floating-point dust never reaches the saved file.
  return Math.min(Math.max(0, Math.round(snapped * 1000) / 1000), Math.max(0, length - 1e-3));
}

export function newSequence(kind: SequenceKind, name: Label): SequenceDef {
  if (kind === 'move')
    return {
      id: createId('sq'),
      kind,
      name,
      length: SEQUENCE_LIMITS.moveBeats.default,
      tracks: [
        { id: createId('tr'), kind: 'notes', notes: [] },
        { id: createId('tr'), kind: 'stage', clips: [] },
      ],
    };
  return {
    id: createId('sq'),
    kind,
    name,
    bpm: SEQUENCE_LIMITS.bpm.default,
    length: SEQUENCE_LIMITS.bars.default * SEQUENCE_LIMITS.beatsPerBar.default,
    tracks: [
      { id: createId('tr'), kind: 'stage', clips: [] },
      { id: createId('tr'), kind: 'text', clips: [] },
      { id: createId('tr'), kind: 'sound', clips: [] },
    ],
  };
}

export function newTrack(kind: TrackKind): SequenceTrack {
  return kind === 'notes'
    ? { id: createId('tr'), kind, notes: [] }
    : { id: createId('tr'), kind, clips: [] };
}

/** The kinds a clip on each track can be; the first is what a tap adds. */
export const CLIP_KINDS = {
  stage: ['effect', 'burst', 'background', 'look', 'transition', 'post'],
  text: ['title'],
  sound: ['sfx', 'ambience'],
  material: ['param'],
} as const satisfies Record<ClipTrackKind, readonly string[]>;
export type ClipKind = (typeof CLIP_KINDS)[ClipTrackKind][number];

/**
 * A clip of `kind` at `at` with settings that show something at once (as new blocks do): the
 * first sound, and the first material that fits.
 */
export function newClip(
  kind: ClipKind,
  at: number,
  sound?: string,
  materials?: readonly MaterialDef[],
): SequenceClip {
  const id = createId('cl');
  if (kind === 'param') {
    const material = materials?.find((m) => m.params.length > 0);
    const param = material?.params[0];
    return {
      id,
      at,
      length: 4,
      action: 'stage.material.param',
      params: material && param
        ? { material: material.id, param: param.id, value: param.min, to: param.max }
        : { material: '', param: '', value: 0 },
    };
  }
  if (kind === 'post') {
    const material = materials?.find((m) => m.domain === 'post');
    return { id, at, action: 'stage.post.set', params: { material: material?.id ?? '' } };
  }
  if (kind === 'sfx') return { id, at, action: 'audio.sfx.play', params: { sound: sound ?? '' } };
  if (kind === 'ambience')
    return { id, at, action: 'audio.ambience.set', params: { slot: 'rain', volume: 0.6, fade: 2 } };
  const block = newStageBlock(id, kind satisfies StageKind);
  return kind === 'title'
    ? { id, at, length: 4, action: block.action, params: { ...block.params, exit: 'fade' } }
    : { id, at, action: block.action, ...(block.params ? { params: block.params } : {}) };
}

export function newNote(kind: SequenceNoteKind, at: number): SequenceNote {
  return { id: createId('nt'), at, kind };
}

export function updateSequence(
  doc: StoryProject,
  id: string,
  change: (sequence: SequenceDef) => SequenceDef,
): StoryProject {
  const sequences = doc.sequences ?? [];
  const index = sequences.findIndex((s) => s.id === id);
  const current = sequences[index];
  if (!current) return doc;
  const next = change(current);
  if (next === current) return doc;
  return { ...doc, sequences: sequences.map((s, i) => (i === index ? next : s)) };
}

export function mapTracks(
  sequence: SequenceDef,
  change: (track: SequenceTrack) => SequenceTrack,
): SequenceDef {
  let changed = false;
  const tracks = sequence.tracks.map((t) => {
    const next = change(t);
    if (next !== t) changed = true;
    return next;
  });
  return changed ? { ...sequence, tracks } : sequence;
}

/** Adds a clip or note to a track (a clip to a clip track, a note to the notes track). */
export function addItem(
  sequence: SequenceDef,
  trackId: string,
  item: SequenceClip | SequenceNote,
): SequenceDef {
  return mapTracks(sequence, (t) => {
    if (t.id !== trackId) return t;
    if (t.kind === 'notes') return 'kind' in item ? { ...t, notes: [...t.notes, item] } : t;
    return 'action' in item ? { ...t, clips: [...t.clips, item] } : t;
  });
}

/** Changes the clip or note with `id`, wherever it is. */
export function updateItem(
  sequence: SequenceDef,
  id: string,
  change: (item: SequenceClip | SequenceNote) => SequenceClip | SequenceNote,
): SequenceDef {
  return mapTracks(sequence, (t) => {
    if (t.kind === 'notes') {
      if (!t.notes.some((n) => n.id === id)) return t;
      return {
        ...t,
        notes: t.notes.map((n) => (n.id === id ? (change(n) as SequenceNote) : n)),
      };
    }
    if (!t.clips.some((c) => c.id === id)) return t;
    return { ...t, clips: t.clips.map((c) => (c.id === id ? (change(c) as SequenceClip) : c)) };
  });
}

export function removeItem(sequence: SequenceDef, id: string): SequenceDef {
  return mapTracks(sequence, (t) =>
    t.kind === 'notes'
      ? t.notes.some((n) => n.id === id)
        ? { ...t, notes: t.notes.filter((n) => n.id !== id) }
        : t
      : t.clips.some((c) => c.id === id)
        ? { ...t, clips: t.clips.filter((c) => c.id !== id) }
        : t,
  );
}

export interface FoundItem {
  readonly track: SequenceTrack;
  readonly item: SequenceClip | SequenceNote;
}

export function findItem(sequence: SequenceDef, id: string | null): FoundItem | null {
  if (!id) return null;
  for (const track of sequence.tracks) {
    const item =
      track.kind === 'notes'
        ? track.notes.find((n) => n.id === id)
        : track.clips.find((c) => c.id === id);
    if (item) return { track, item };
  }
  return null;
}

/** A copy of the item one step later on the same track; returns the sequence and the copy's ID. */
export function duplicateItem(
  sequence: SequenceDef,
  id: string,
  step: number,
): { sequence: SequenceDef; id: string | null } {
  const found = findItem(sequence, id);
  if (!found) return { sequence, id: null };
  const at = Math.min(
    found.item.at + ('length' in found.item && found.item.length ? found.item.length : step),
    sequence.length - step,
  );
  const copy = { ...found.item, id: createId('action' in found.item ? 'cl' : 'nt'), at };
  return { sequence: addItem(sequence, found.track.id, copy), id: copy.id };
}

/**
 * Cuts a clip with a length in two at `at` (the razor). Moments and notes have no length, so
 * there is nothing to cut; the sequence comes back unchanged.
 */
export function splitClip(sequence: SequenceDef, id: string, at: number): SequenceDef {
  const found = findItem(sequence, id);
  const clip = found?.item;
  if (!found || !clip || !('action' in clip) || !clip.length) return sequence;
  const end = clip.at + clip.length;
  if (at <= clip.at || at >= end) return sequence;
  const second: SequenceClip = { ...clip, id: createId('cl'), at, length: end - at };
  const cut = updateItem(sequence, id, (c) => ({ ...c, length: at - clip.at }));
  return addItem(cut, found.track.id, second);
}

/** Changes the length, dropping clips and notes that would start after the new end. */
export function setLength(sequence: SequenceDef, length: number): SequenceDef {
  return {
    ...mapTracks(sequence, (t) =>
      t.kind === 'notes'
        ? { ...t, notes: t.notes.filter((n) => n.at < length) }
        : { ...t, clips: t.clips.filter((c) => c.at < length) },
    ),
    length,
  };
}
