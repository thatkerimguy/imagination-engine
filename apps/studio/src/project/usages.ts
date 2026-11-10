import {
  compileFormula,
  markupReferences,
  parseMarkup,
  references,
  type Block,
  type Formula,
  type StoryProject,
} from '@ie/story';
import { blockTexts, walkBlocks } from './tree.ts';

export interface Usages {
  readonly variables: ReadonlyMap<string, number>;
  readonly characters: ReadonlyMap<string, number>;
  /** Tracks and sounds, by ID, from the audio blocks. */
  readonly audio: ReadonlyMap<string, number>;
}

function formulasOf(block: Block): Formula[] {
  switch (block.type) {
    case 'choice':
      return block.options.flatMap((o) => [
        ...(o.visibleIf === undefined ? [] : [o.visibleIf]),
        ...(o.enabledIf === undefined ? [] : [o.enabledIf]),
        ...(o.cost ? [o.cost.amount] : []),
      ]);
    case 'if':
      return block.branches.map((b) => b.when);
    case 'check':
      return [block.target, ...(block.modifier === undefined ? [] : [block.modifier])];
    case 'set':
      return block.value === undefined ? [] : [block.value];
    default:
      return [];
  }
}

/** How many places use each variable and character ("find usages", and a warning before delete). */
export function countUsages(doc: StoryProject): Usages {
  const variables = new Map<string, number>();
  const characters = new Map<string, number>();
  const audio = new Map<string, number>();
  const bump = (map: Map<string, number>, id: string) => map.set(id, (map.get(id) ?? 0) + 1);

  walkBlocks(doc, ({ block }) => {
    if (block.type === 'dialogue') bump(characters, block.speaker);
    if (block.type === 'action') {
      const p = block.params ?? {};
      const id =
        block.action === 'audio.music.set'
          ? p.track
          : block.action === 'audio.sfx.play'
            ? p.sound
            : null;
      if (typeof id === 'string') bump(audio, id);
    }
    if (block.type === 'set' || block.type === 'input') bump(variables, block.var);
    if (block.type === 'choice')
      for (const o of block.options) if (o.cost) bump(variables, o.cost.var);
    for (const formula of formulasOf(block)) {
      try {
        for (const id of references(compileFormula(formula)).vars) bump(variables, id);
      } catch {
        // A broken formula is reported by the validator; it just counts as no usage here.
      }
    }
    for (const text of blockTexts(block)) {
      for (const source of [text.en, text.tr]) {
        if (!source) continue;
        try {
          const refs = markupReferences(parseMarkup(source));
          refs.vars.forEach((id) => bump(variables, id));
          refs.characters.forEach((id) => bump(characters, id));
        } catch {
          // Same as above: broken markup is the validator's to report.
        }
      }
    }
  });
  return { variables, characters, audio };
}
