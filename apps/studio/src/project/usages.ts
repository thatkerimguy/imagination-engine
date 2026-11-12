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
  /** Enemies, by ID, from the fight blocks. */
  readonly enemies: ReadonlyMap<string, number>;
  /** Items, quests and routines, from their blocks, shops and formulas. */
  readonly items: ReadonlyMap<string, number>;
  readonly quests: ReadonlyMap<string, number>;
  readonly routines: ReadonlyMap<string, number>;
  /** Sequences, from Sequence blocks, fight charts and enemy moves. */
  readonly sequences: ReadonlyMap<string, number>;
  readonly materials: ReadonlyMap<string, number>;
  /** Beatmaps, from Rhythm blocks. */
  readonly beatmaps: ReadonlyMap<string, number>;
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
    case 'item':
      return block.count === undefined ? [] : [block.count];
    case 'routine':
      return Object.values(block.args ?? {});
    default:
      return [];
  }
}

/** How many places use each variable and character ("find usages", and a warning before delete). */
export function countUsages(doc: StoryProject): Usages {
  const variables = new Map<string, number>();
  const characters = new Map<string, number>();
  const audio = new Map<string, number>();
  const enemies = new Map<string, number>();
  const items = new Map<string, number>();
  const quests = new Map<string, number>();
  const routines = new Map<string, number>();
  const sequences = new Map<string, number>();
  const materials = new Map<string, number>();
  const beatmaps = new Map<string, number>();
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
      if (typeof p.material === 'string' && p.material) bump(materials, p.material);
    }
    if (block.type === 'set' || block.type === 'input') bump(variables, block.var);
    if (block.type === 'fight') {
      bump(enemies, block.enemy);
      if (block.track) bump(audio, block.track);
      if (block.score) bump(variables, block.score);
      if (block.chart) bump(sequences, block.chart);
    }
    if (block.type === 'minigame') {
      if (block.score) bump(variables, block.score);
      for (const id of Object.values(block.store ?? {})) bump(variables, id);
    }
    if (block.type === 'rhythm') {
      bump(beatmaps, block.beatmap);
      if (block.score) bump(variables, block.score);
    }
    if (block.type === 'sequence') bump(sequences, block.sequence);
    if (block.type === 'choice')
      for (const o of block.options) if (o.cost) bump(variables, o.cost.var);
    if (block.type === 'item') bump(items, block.item);
    if (block.type === 'quest') bump(quests, block.quest);
    if (block.type === 'battle') bump(enemies, block.enemy);
    if (block.type === 'routine') bump(routines, block.routine);
    if (block.type === 'shop') {
      bump(variables, block.currency);
      for (const stock of block.stock) bump(items, stock.item);
    }
    for (const formula of formulasOf(block)) {
      try {
        const refs = references(compileFormula(formula));
        for (const id of refs.vars) bump(variables, id);
        for (const id of refs.items) bump(items, id);
        for (const id of refs.quests) bump(quests, id);
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
  for (const id of Object.values(doc.hero ?? {})) if (typeof id === 'string') bump(variables, id);
  for (const item of doc.items ?? [])
    for (const effect of item.effects ?? []) bump(variables, effect.var);
  for (const rule of doc.rules ?? []) {
    if (!rule.target) continue;
    if (rule.on === 'changed') bump(variables, rule.target);
    else if (rule.on === 'gained' || rule.on === 'lost') bump(items, rule.target);
    else if (rule.on === 'quest') bump(quests, rule.target);
  }
  for (const enemy of doc.enemies ?? [])
    for (const move of enemy.moves) if (move.sequence) bump(sequences, move.sequence);
  for (const sequence of doc.sequences ?? []) {
    if (sequence.track) bump(audio, sequence.track);
    for (const track of sequence.tracks)
      if (track.kind !== 'notes')
        for (const clip of track.clips) {
          const material = clip.params?.material;
          if (typeof material === 'string' && material) bump(materials, material);
        }
  }
  for (const map of doc.beatmaps ?? []) if (map.track) bump(audio, map.track);
  return {
    variables,
    characters,
    audio,
    enemies,
    items,
    quests,
    routines,
    sequences,
    materials,
    beatmaps,
  };
}
