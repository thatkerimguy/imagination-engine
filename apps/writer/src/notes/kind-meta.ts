// Story Bible entity kinds: every one is a document (same editor, search and links as a note).
// Pure data, no react-native; icons are Feather names.
export const STORY_KINDS = ['note', 'character', 'location', 'lore'] as const;

export type StoryKind = (typeof STORY_KINDS)[number];

export interface KindMeta {
  icon: 'file-text' | 'user' | 'map-pin' | 'book-open';
  label: string;
  plural: string;
}

export const KIND_META: Readonly<Record<StoryKind, KindMeta>> = {
  note: { icon: 'file-text', label: 'Note', plural: 'Notes' },
  character: { icon: 'user', label: 'Character', plural: 'Characters' },
  location: { icon: 'map-pin', label: 'Location', plural: 'Locations' },
  lore: { icon: 'book-open', label: 'Lore', plural: 'Lore' },
};

export const isStoryKind = (k: unknown): k is StoryKind =>
  typeof k === 'string' && (STORY_KINDS as readonly string[]).includes(k);
