import {
  createMemoryStore,
  isIndexedDbSupported,
  openIndexedDbStore,
  type KeyValueStore,
} from '@ie/core';
import { storyProjectSchema, type StoryProject } from '@ie/story';
import { z } from 'zod';

/**
 * Studio projects in IndexedDB (ADR 0005, ADR 0011): one record per project holding the whole story
 * document, validated on every read. The same document is what Export writes and the Player plays.
 */

const PREFIX = 'project:';

const recordSchema = z.object({
  v: z.literal(1),
  updatedAt: z.number(),
  doc: storyProjectSchema,
});

export interface ProjectSummary {
  readonly id: string;
  readonly title: StoryProject['title'];
  readonly updatedAt: number;
}

let opened: Promise<KeyValueStore> | null = null;

/** The Studio's store; in memory when IndexedDB is unavailable (some private windows). */
export function projectStore(): Promise<KeyValueStore> {
  opened ??= (async () => {
    if (!isIndexedDbSupported()) return createMemoryStore();
    try {
      return await openIndexedDbStore('imagination-studio');
    } catch (error) {
      console.warn('IndexedDB is unavailable; projects will not be kept.', error);
      return createMemoryStore();
    }
  })();
  return opened;
}

export async function readProject(store: KeyValueStore, id: string): Promise<StoryProject | null> {
  const parsed = recordSchema.safeParse(await store.get(PREFIX + id));
  if (!parsed.success) {
    if ((await store.get(PREFIX + id)) !== undefined)
      console.warn(`Project ${id} could not be read.`, parsed.error);
    return null;
  }
  return parsed.data.doc;
}

export async function writeProject(store: KeyValueStore, doc: StoryProject): Promise<void> {
  await store.set(PREFIX + doc.id, { v: 1, updatedAt: Date.now(), doc });
}

export async function deleteProject(store: KeyValueStore, id: string): Promise<void> {
  await store.delete(PREFIX + id);
}

/** Every readable project, newest first. */
export async function listProjects(store: KeyValueStore): Promise<ProjectSummary[]> {
  const keys = await store.keys(PREFIX);
  const summaries: ProjectSummary[] = [];
  for (const key of keys) {
    const parsed = recordSchema.safeParse(await store.get(key));
    if (parsed.success)
      summaries.push({
        id: parsed.data.doc.id,
        title: parsed.data.doc.title,
        updatedAt: parsed.data.updatedAt,
      });
  }
  return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Reads an exported story file. Throws with the schema's message when it isn't a valid story. */
export function parseStoryFile(text: string): StoryProject {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('not-json');
  }
  const parsed = storyProjectSchema.safeParse(json);
  if (!parsed.success) throw new Error(z.prettifyError(parsed.error));
  return parsed.data;
}
