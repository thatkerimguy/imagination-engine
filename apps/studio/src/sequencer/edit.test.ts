import { sequenceSchema, type SequenceClip } from '@ie/story';
import { describe, expect, it } from 'vitest';
import {
  addItem,
  duplicateItem,
  findItem,
  newClip,
  newNote,
  newSequence,
  removeItem,
  setLength,
  snapBeats,
  snapTo,
  splitClip,
  updateItem,
} from './edit.ts';

const scene = () => newSequence('scene', { en: 'Opening', tr: 'Açılış' });

describe('sequence edits', () => {
  it('make new scenes and moves that validate', () => {
    expect(sequenceSchema.safeParse(scene()).success).toBe(true);
    const move = newSequence('move', { en: 'Lunge' });
    expect(sequenceSchema.safeParse(move).success).toBe(true);
    expect(move.tracks.map((t) => t.kind)).toEqual(['notes', 'stage']);
  });

  it('snap to the grid and stay inside the sequence', () => {
    const s = scene();
    expect(snapBeats('bar', s)).toBe(4);
    expect(snapTo(2.38, 0.25, 16)).toBe(2.5);
    expect(snapTo(-3, 1, 16)).toBe(0);
    expect(snapTo(40, 1, 16)).toBeLessThan(16);
    expect(snapTo(1 / 3, 0.0625, 16)).toBe(0.313);
  });

  it('add, move, find and remove clips and notes', () => {
    let s = scene();
    const stage = s.tracks[0]?.id ?? '';
    const clip = newClip('effect', 2);
    s = addItem(s, stage, clip);
    expect(findItem(s, clip.id)?.track.id).toBe(stage);
    // A note can't go on a clip track.
    expect(addItem(s, stage, newNote('parry', 1))).toBe(s);
    s = updateItem(s, clip.id, (c) => ({ ...c, at: 3 }));
    expect(findItem(s, clip.id)?.item.at).toBe(3);
    s = removeItem(s, clip.id);
    expect(findItem(s, clip.id)).toBeNull();
    expect(sequenceSchema.safeParse(s).success).toBe(true);
  });

  it('give new clips working settings', () => {
    expect(newClip('title', 0)).toMatchObject({ action: 'stage.title', length: 4 });
    expect(newClip('sfx', 1, 'boom')).toMatchObject({ params: { sound: 'boom' } });
    expect(newClip('ambience', 1)).toMatchObject({ action: 'audio.ambience.set' });
  });

  it('split a clip at the playhead and duplicate an item after itself', () => {
    let s = scene();
    const text = s.tracks[1]?.id ?? '';
    const title = newClip('title', 4);
    s = addItem(s, text, title);
    s = splitClip(s, title.id, 5);
    const clips = (s.tracks[1] as unknown as { clips: SequenceClip[] }).clips;
    expect(clips.map((c) => [c.at, c.length])).toEqual([
      [4, 1],
      [5, 3],
    ]);
    // Outside the clip, or on a moment, a split changes nothing.
    expect(splitClip(s, title.id, 9)).toBe(s);
    const copy = duplicateItem(s, title.id, 1);
    expect(findItem(copy.sequence, copy.id)?.item.at).toBe(5);
  });

  it('drop what starts after a shorter length', () => {
    let s = scene();
    const stage = s.tracks[0]?.id ?? '';
    s = addItem(s, stage, newClip('effect', 2));
    s = addItem(s, stage, newClip('effect', 10));
    s = setLength(s, 8);
    expect(s.length).toBe(8);
    expect((s.tracks[0] as unknown as { clips: SequenceClip[] }).clips).toHaveLength(1);
  });
});
