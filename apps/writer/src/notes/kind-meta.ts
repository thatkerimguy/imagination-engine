// Story Bible entity kinds: every one is a document (same editor, search and links as a note).
// Pure data, no react-native; icons/labels come from ui/node-kind.ts.
import type { StringKey } from '../i18n/i18n.ts';
import { NODE_KIND_META, type NodeKindIcon } from '../ui/node-kind.ts';

export const STORY_KINDS = ['note', 'character', 'location', 'lore'] as const;

export type StoryKind = (typeof STORY_KINDS)[number];

export interface KindMeta {
  icon: NodeKindIcon;
  /** `kind.<kind>` (singular) and `kinds.<kind>` (plural) i18n keys. */
  labelKey: StringKey;
  pluralKey: StringKey;
  /** English fallbacks for non-React callers. */
  label: string;
  plural: string;
}

const make = (k: StoryKind, label: string, plural: string): KindMeta => ({
  icon: NODE_KIND_META[k].icon,
  labelKey: NODE_KIND_META[k].labelKey,
  pluralKey: `kinds.${k}` as StringKey,
  label,
  plural,
});

export const KIND_META: Readonly<Record<StoryKind, KindMeta>> = {
  note: make('note', 'Note', 'Notes'),
  character: make('character', 'Character', 'Characters'),
  location: make('location', 'Location', 'Locations'),
  lore: make('lore', 'Lore', 'Lore'),
};

export const isStoryKind = (k: unknown): k is StoryKind =>
  typeof k === 'string' && (STORY_KINDS as readonly string[]).includes(k);
