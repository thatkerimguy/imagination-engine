import type { Locale } from '@ie/i18n';
import {
  libraryEffectSchema,
  type LibraryContent,
  type LibraryKind,
  type StoryProject,
} from '@ie/story';
import { allPassages, walkBlocks } from '../project/tree.ts';
import { labelText } from '../write/edit.ts';

/** Something in the open project that can be saved to the Library. */
export interface LibrarySource {
  /** Unique within the project: the kind and the thing's own ID. */
  readonly key: string;
  readonly kind: LibraryKind;
  /** A starting name for the Library item. */
  readonly name: string;
  readonly content: LibraryContent;
}

/**
 * Everything in a project worth keeping: its sequences, materials, enemies, screens and theme,
 * and every stage or sound Action block as an effect (named after its action and passage).
 */
export function librarySources(
  doc: StoryProject,
  locale: Locale,
  themeName: string,
): LibrarySource[] {
  const name = (label: { en?: string; tr?: string }, id: string) => labelText(label, locale, id);
  const sources: LibrarySource[] = [];
  for (const data of doc.sequences ?? [])
    sources.push({
      key: `sequence:${data.id}`,
      kind: 'sequence',
      name: name(data.name, data.id),
      content: { kind: 'sequence', data },
    });
  for (const data of doc.materials ?? [])
    sources.push({
      key: `material:${data.id}`,
      kind: 'material',
      name: name(data.name, data.id),
      content: { kind: 'material', data },
    });
  for (const data of doc.enemies ?? [])
    sources.push({
      key: `enemy:${data.id}`,
      kind: 'enemy',
      name: name(data.name, data.id),
      content: { kind: 'enemy', data },
    });
  for (const data of doc.screens ?? [])
    sources.push({
      key: `screen:${data.id}`,
      kind: 'screen',
      name: name(data.name, data.id),
      content: { kind: 'screen', data },
    });
  if (doc.theme)
    sources.push({
      key: 'theme',
      kind: 'theme',
      name: themeName,
      content: { kind: 'theme', data: doc.theme },
    });
  const passageNames = new Map(allPassages(doc).map((p) => [p.id, p.name || p.id]));
  walkBlocks(doc, ({ block, passageId }) => {
    if (block.type !== 'action') return;
    const effect = libraryEffectSchema.safeParse({
      action: block.action,
      ...(block.params ? { params: block.params } : {}),
    });
    if (!effect.success) return;
    const where = passageNames.get(passageId);
    sources.push({
      key: `effect:${block.id}`,
      kind: 'effect',
      name: where ? `${block.action} · ${where}` : block.action,
      content: { kind: 'effect', data: effect.data },
    });
  });
  return sources;
}
