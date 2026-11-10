import type { Locale } from '@ie/i18n';
import type { Block, Label, StoryProject, VariableType } from '@ie/story';
import { useMemo } from 'react';
import { cloneBlock, newCharacter, newEnemy, newPassage, newVariable } from '../project/factory.ts';
import { currentPassageId, useProject } from '../project/store.ts';
import {
  findBlock,
  insertBlock,
  moveBlock,
  removeBlock,
  setLineText,
  updateBlock,
  updatePassage,
  type BlockPlace,
} from '../project/tree.ts';
import { useStudio } from '../store.ts';

/** A label in the given language, falling back to the other one, then to `fallback`. */
export function labelText(label: Label | undefined, locale: Locale, fallback = ''): string {
  return label?.[locale] || label?.en || label?.tr || fallback;
}

/** The language being written: chosen in Manuscript, else the Studio's own language. */
export function useWriteLocale(): Locale {
  const studio = useStudio((s) => s.locale);
  return useProject((s) => s.writeLocale) ?? studio;
}

export function usePassageId(doc: StoryProject): string {
  return currentPassageId(
    doc,
    useProject((s) => s.passageId),
  );
}

/** Every edit the block editors make, each one undoable. */
export function useEditor() {
  const edit = useProject((s) => s.edit);
  return useMemo(
    () => ({
      edit,
      block(id: string, change: (b: Block) => Block, mergeKey?: string) {
        edit((doc) => updateBlock(doc, id, change), mergeKey);
      },
      text(lineId: string, locale: Locale, value: string) {
        edit((doc) => setLineText(doc, lineId, locale, value), `text:${lineId}:${locale}`);
      },
      insert(listKey: string, index: number, block: Block) {
        edit((doc) => insertBlock(doc, listKey, index, block));
      },
      remove(id: string) {
        edit((doc) => removeBlock(doc, id));
      },
      move(id: string, delta: -1 | 1) {
        edit((doc) => moveBlock(doc, id, delta));
      },
      duplicate(place: BlockPlace) {
        edit((doc) => insertBlock(doc, place.listKey, place.index + 1, cloneBlock(place.block)));
      },
      renamePassage(id: string, name: string) {
        edit((doc) => updatePassage(doc, id, (p) => ({ ...p, name })), `passage:${id}`);
      },
      /** Adds a passage to the first chapter and returns its ID. */
      addPassage(name: string): string {
        const passage = newPassage(name);
        edit((doc) => ({
          ...doc,
          chapters: doc.chapters.map((c, i) =>
            i === 0 ? { ...c, passages: [...c.passages, passage] } : c,
          ),
        }));
        return passage.id;
      },
      addCharacter(name: Label): string {
        const character = newCharacter(name);
        edit((doc) => ({ ...doc, characters: [...doc.characters, character] }));
        return character.id;
      },
      addEnemy(name: Label): string {
        const enemy = newEnemy(name);
        edit((doc) => ({ ...doc, enemies: [...(doc.enemies ?? []), enemy] }));
        return enemy.id;
      },
      addVariable(type: VariableType, name: Label): string {
        const variable = newVariable(type, name);
        edit((doc) => ({ ...doc, variables: [...doc.variables, variable] }));
        return variable.id;
      },
    }),
    [edit],
  );
}

export type Editor = ReturnType<typeof useEditor>;

export function placeOf(doc: StoryProject, id: string): BlockPlace | undefined {
  return findBlock(doc, id);
}

/** A name for a new item that isn't taken yet: "Passage 3", "Bölüm 3". */
export function nextName(base: string, taken: readonly string[]): string {
  for (let n = taken.length + 1; ; n++) {
    const name = `${base} ${n}`;
    if (!taken.includes(name)) return name;
  }
}
