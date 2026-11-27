// One icon + label per node kind, shared by Recent, Trash, Search and Notes. Pure (no
// react-native); icons are Feather names, labels are `kind.<kind>` i18n keys.
import { t, type Locale, type StringKey } from '../i18n/i18n.ts';

export type NodeKindName =
  'book' | 'season' | 'chapter' | 'folder' | 'note' | 'character' | 'location' | 'lore';

export type NodeKindIcon =
  'book' | 'layers' | 'file-text' | 'folder' | 'user' | 'map-pin' | 'book-open';

export interface NodeKindMeta {
  icon: NodeKindIcon;
  labelKey: StringKey;
}

export const NODE_KIND_META: Readonly<Record<NodeKindName, NodeKindMeta>> = {
  book: { icon: 'book', labelKey: 'kind.book' },
  season: { icon: 'layers', labelKey: 'kind.season' },
  chapter: { icon: 'file-text', labelKey: 'kind.chapter' },
  folder: { icon: 'folder', labelKey: 'kind.folder' },
  note: { icon: 'file-text', labelKey: 'kind.note' },
  character: { icon: 'user', labelKey: 'kind.character' },
  location: { icon: 'map-pin', labelKey: 'kind.location' },
  lore: { icon: 'book-open', labelKey: 'kind.lore' },
};

/** The localized singular label of a node kind ("Character"). */
export const nodeKindLabel = (kind: NodeKindName, locale: Locale = 'en'): string =>
  t(NODE_KIND_META[kind].labelKey, undefined, locale);
