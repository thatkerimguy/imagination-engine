import { readParsed, valueSchema, type KeyValueStore, type Value } from '@ie/core';
import { storyStateSchema, type StoryState } from '@ie/story';
import { z } from 'zod';

/** Manual save slots. `auto` is written after every reader action. */
export const SLOTS = [1, 2, 3] as const;
export type SlotId = 'auto' | (typeof SLOTS)[number];

export const saveFileSchema = z.object({
  v: z.literal(1),
  storyId: z.string(),
  savedAt: z.number(),
  state: storyStateSchema,
});
export type SaveFile = z.infer<typeof saveFileSchema>;

/** Persistent variables and unlocked endings: kept outside the slots, shared by every playthrough. */
const persistentSchema = z.record(z.string(), valueSchema);

/** One rewind step, stored on its own so "Back" still works after the system closes the tab. */
const historyEntrySchema = z.object({
  v: z.literal(1),
  storyId: z.string(),
  seq: z.number().int(),
  state: storyStateSchema,
});
export type HistoryFile = z.infer<typeof historyEntrySchema>;

export const saveKey = (storyId: string, slot: SlotId) => `save:${storyId}:${slot}`;
export const persistentKey = (storyId: string) => `persist:${storyId}`;
export const historyPrefix = (storyId: string) => `history:${storyId}:`;
const historyKey = (storyId: string, seq: number) =>
  `${historyPrefix(storyId)}${String(seq).padStart(9, '0')}`;

/**
 * Reads a save. A damaged or outdated save reads as empty, with a warning, so the reader can
 * always start; it is never trusted as-is.
 */
export async function readSave(
  store: KeyValueStore,
  storyId: string,
  slot: SlotId,
): Promise<SaveFile | undefined> {
  try {
    const save = await readParsed(store, saveKey(storyId, slot), saveFileSchema);
    return save?.storyId === storyId ? save : undefined;
  } catch (error) {
    console.warn(error);
    return undefined;
  }
}

export async function writeSave(
  store: KeyValueStore,
  storyId: string,
  slot: SlotId,
  state: StoryState,
  savedAt: number = Date.now(),
): Promise<void> {
  const file: SaveFile = { v: 1, storyId, savedAt, state };
  await store.set(saveKey(storyId, slot), file);
}

export async function readPersistent(
  store: KeyValueStore,
  storyId: string,
): Promise<Record<string, Value>> {
  try {
    return (await readParsed(store, persistentKey(storyId), persistentSchema)) ?? {};
  } catch (error) {
    console.warn(error);
    return {};
  }
}

export async function writePersistent(
  store: KeyValueStore,
  storyId: string,
  values: Readonly<Record<string, Value>>,
): Promise<void> {
  await store.set(persistentKey(storyId), values);
}

/** Every stored rewind step; damaged ones are skipped. */
export async function readHistory(store: KeyValueStore, storyId: string): Promise<HistoryFile[]> {
  const keys = await store.keys(historyPrefix(storyId));
  const files = await Promise.all(
    keys.map(async (key) => {
      try {
        return await readParsed(store, key, historyEntrySchema);
      } catch (error) {
        console.warn(error);
        return undefined;
      }
    }),
  );
  return files.filter((f): f is HistoryFile => f?.storyId === storyId);
}

export async function writeHistoryEntry(
  store: KeyValueStore,
  storyId: string,
  seq: number,
  state: StoryState,
): Promise<void> {
  const file: HistoryFile = { v: 1, storyId, seq, state };
  await store.set(historyKey(storyId, seq), file);
}

export async function deleteHistoryEntry(
  store: KeyValueStore,
  storyId: string,
  seq: number,
): Promise<void> {
  await store.delete(historyKey(storyId, seq));
}
