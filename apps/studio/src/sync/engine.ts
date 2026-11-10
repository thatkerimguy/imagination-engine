import { jsonEqual, merge3 } from '@ie/core';
import { storyProjectSchema, type StoryProject } from '@ie/story';
import type { SyncRemote } from './remote.ts';

/*
 * One sync of one story (ADR 0024): read the store's copy, merge it three ways with this device's
 * copy over the last copy both had (the base), and write the result back guarded by the store's
 * version tag. If another device wrote in between, start again.
 */

export type SyncKind = 'same' | 'pushed' | 'pulled' | 'merged';

export interface SyncOutcome {
  readonly kind: SyncKind;
  /** The story this device should now have. */
  readonly doc: StoryProject;
  /** What both sides now share: the next sync's base. */
  readonly base: StoryProject;
  /** Values both sides changed differently; this device's change was kept. */
  readonly conflicts: readonly string[];
}

const ATTEMPTS = 4;

/** Merges two copies; a merge that breaks the schema keeps this device's copy whole instead. */
export function mergeCopies(
  base: StoryProject | null,
  ours: StoryProject,
  theirs: StoryProject,
): { doc: StoryProject; conflicts: readonly string[] } {
  const { value, conflicts } = merge3<StoryProject>(base ?? undefined, ours, theirs, 'ours');
  if (value === ours || storyProjectSchema.safeParse(value).success)
    return { doc: value, conflicts };
  return { doc: ours, conflicts: [...conflicts, '/'] };
}

export async function syncOnce(
  remote: SyncRemote,
  ours: StoryProject,
  base: StoryProject | null,
): Promise<SyncOutcome> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const copy = await remote.get(ours.id);
    if (!copy) {
      if ((await remote.put(ours, null)) !== null) {
        return { kind: 'pushed', doc: ours, base: ours, conflicts: [] };
      }
      continue; // another device made the first copy just now
    }
    const theirs = copy.doc;
    if (jsonEqual(theirs, ours)) return { kind: 'same', doc: ours, base: theirs, conflicts: [] };
    const { doc, conflicts } = mergeCopies(base, ours, theirs);
    if (jsonEqual(doc, theirs)) return { kind: 'pulled', doc: theirs, base: theirs, conflicts };
    if ((await remote.put(doc, copy.etag)) !== null) {
      return { kind: jsonEqual(doc, ours) ? 'pushed' : 'merged', doc, base: doc, conflicts };
    }
  }
  throw new Error('The sync store kept changing; try again.');
}
