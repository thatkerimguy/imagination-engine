// Takedown tombstones: `takedowns/<slug>.json`. Never served by the public /novels/* route.
import type { ObjectStore } from './store.ts';

export const tombstoneKey = (slug: string): string => `takedowns/${slug}.json`;

export const TAKEN_DOWN_MESSAGE = 'This novel was taken down by moderation';

export async function isTakenDown(store: ObjectStore, slug: string): Promise<boolean> {
  return (await store.get(tombstoneKey(slug))) !== null;
}

/** Parsed `novels/<slug>/novel.json`, or null when missing / unreadable. */
export async function readNovelDoc(
  store: ObjectStore,
  slug: string,
): Promise<Record<string, unknown> | null> {
  const obj = await store.get(`novels/${slug}/novel.json`);
  if (!obj) return null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(obj.body));
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
