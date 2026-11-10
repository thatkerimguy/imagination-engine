import { createId } from '@ie/core';
import {
  STORY_FORMAT,
  STORY_SCHEMA_VERSION,
  type Block,
  type BlockType,
  type CharacterDef,
  type ChoiceOption,
  type EnemyDef,
  type Label,
  type LocalText,
  type Passage,
  type StoryProject,
  type VariableDef,
  type VariableType,
} from '@ie/story';
import {
  cloneBattle,
  newRpgBlock,
  RPG_BLOCKS,
  type RpgBlockType,
  type RpgDefaults,
} from './factory-rpg.ts';
import { newStageBlock, STAGE_KIND_LIST, type StageKind } from './stage-kinds.ts';

/** A new, empty line in both languages. The line ID is its translation key. */
export function newText(en = '', tr = ''): LocalText {
  return { id: createId('l'), en, tr };
}

export function newOption(label?: Label): ChoiceOption {
  return { id: createId('o'), text: newText(label?.en, label?.tr), then: [] };
}

export function newPassage(name: string): Passage {
  return { id: createId('p'), name, blocks: [newBlock('narration')] };
}

/** The blocks an author can add from the block menu. */
export const BLOCK_MENU = [
  'narration',
  'dialogue',
  'choice',
  'if',
  'check',
  'fight',
  'input',
  ...RPG_BLOCKS,
  'set',
  'jump',
  'call',
  'return',
  'random',
  'pause',
  'end',
  'note',
  'music',
  'sfx',
  'ambience',
  ...STAGE_KIND_LIST,
] as const satisfies readonly (BlockType | AudioKind | StageKind)[];
/** Action blocks are made through their kinds (audio, stage), never bare. */
export type MenuBlockType = Exclude<BlockType, 'action'> | AudioKind | StageKind;

/** Audio blocks are action blocks; the menu shows each as a block of its own. */
export const AUDIO_KINDS = {
  music: 'audio.music.set',
  sfx: 'audio.sfx.play',
  ambience: 'audio.ambience.set',
} as const;
export type AudioKind = keyof typeof AUDIO_KINDS;

/** The audio kind of an action block, or null for any other block. */
export function audioKind(block: Block): AudioKind | null {
  if (block.type !== 'action') return null;
  const found = Object.entries(AUDIO_KINDS).find(([, action]) => action === block.action);
  return found ? (found[0] as AudioKind) : null;
}

export interface BlockDefaults extends RpgDefaults {
  readonly speaker?: string;
  readonly variable?: string;
  readonly textVariable?: string;
  readonly passage?: string;
  readonly track?: string;
  readonly sound?: string;
  readonly enemy?: string;
}

/** A new block of a type, filled with sensible defaults so it is valid straight away. */
export function newBlock(type: MenuBlockType, defaults: BlockDefaults = {}): Block {
  const id = createId('b');
  switch (type) {
    case 'narration':
      return { id, type, text: newText() };
    case 'dialogue':
      return { id, type, speaker: defaults.speaker ?? '', text: newText() };
    case 'choice':
      return { id, type, options: [newOption(), newOption()] };
    case 'if':
      return { id, type, branches: [{ id: createId('br'), when: true, then: [] }] };
    case 'check':
      return { id, type, dice: '1d20', target: 10, success: [], fail: [] };
    case 'fight':
      return { id, type, enemy: defaults.enemy ?? '', win: [], lose: [] };
    case 'input':
      return { id, type, var: defaults.textVariable ?? '', prompt: newText() };
    case 'set':
      return { id, type, var: defaults.variable ?? '', op: 'set', value: 0 };
    case 'jump':
    case 'call':
      return { id, type, to: defaults.passage ?? '' };
    case 'return':
      return { id, type };
    case 'random':
      return {
        id,
        type,
        branches: [
          { id: createId('br'), then: [] },
          { id: createId('br'), then: [] },
        ],
      };
    case 'pause':
      return { id, type };
    case 'end':
      return { id, type };
    case 'note':
      return { id, type, text: '' };
    case 'music':
      return {
        id,
        type: 'action',
        action: AUDIO_KINDS.music,
        params: { track: defaults.track ?? null, fade: 2 },
      };
    case 'sfx':
      return {
        id,
        type: 'action',
        action: AUDIO_KINDS.sfx,
        params: { sound: defaults.sound ?? '' },
      };
    case 'ambience':
      return {
        id,
        type: 'action',
        action: AUDIO_KINDS.ambience,
        params: { slot: 'rain', volume: 0.6, fade: 3 },
      };
    case 'item':
    case 'quest':
    case 'shop':
    case 'battle':
    case 'routine':
      return newRpgBlock(type satisfies RpgBlockType, id, defaults);
    default:
      return newStageBlock(id, type);
  }
}

export function newVariable(type: VariableType, name: Label): VariableDef {
  const base = { id: createId('v'), name, type, scope: 'game' as const };
  return type === 'enum' ? { ...base, values: ['a', 'b'] } : base;
}

export function newCharacter(name: Label): CharacterDef {
  return { id: createId('c'), name };
}

/** A new enemy with three moves (two to parry, one to dodge), so it can fight straight away. */
export function newEnemy(name: Label): EnemyDef {
  return {
    id: createId('en'),
    name,
    hp: 100,
    attack: 10,
    moves: [
      {
        id: createId('m'),
        name: { en: 'Quick cut', tr: 'Hızlı kesik' },
        pattern: 'jab',
        answer: 'parry',
      },
      {
        id: createId('m'),
        name: { en: 'Double cut', tr: 'Çifte kesik' },
        pattern: 'double',
        answer: 'parry',
      },
      {
        id: createId('m'),
        name: { en: 'Low sweep', tr: 'Alçak süpürme' },
        pattern: 'sweep',
        answer: 'dodge',
      },
    ],
  };
}

/** A new novel: one chapter with one passage holding one empty line. */
export function newProject(title: Label, startName = 'Start'): StoryProject {
  const start = newPassage(startName);
  return {
    format: STORY_FORMAT,
    schemaVersion: STORY_SCHEMA_VERSION,
    id: createId('n'),
    title,
    languages: ['en', 'tr'],
    start: start.id,
    variables: [],
    characters: [],
    chapters: [
      { id: createId('ch'), title: { en: 'Chapter 1', tr: 'Bölüm 1' }, passages: [start] },
    ],
  };
}

/** Gives a copied block (and everything inside it) fresh IDs, so the copy is independent. */
export function cloneBlock(block: Block): Block {
  const fresh = (prefix: string) => createId(prefix);
  const text = (t: LocalText): LocalText => ({ ...t, id: fresh('l') });
  const list = (blocks: readonly Block[]) => blocks.map(cloneBlock);
  const id = fresh('b');
  switch (block.type) {
    case 'narration':
    case 'dialogue':
      return { ...block, id, text: text(block.text) };
    case 'choice': {
      const ids = new Map(block.options.map((o) => [o.id, fresh('o')]));
      const timerDefault = block.timer?.default && ids.get(block.timer.default);
      return {
        ...block,
        id,
        ...(block.prompt ? { prompt: text(block.prompt) } : {}),
        ...(block.timer
          ? {
              timer: timerDefault
                ? { ...block.timer, default: timerDefault }
                : { seconds: block.timer.seconds },
            }
          : {}),
        options: block.options.map((o) => ({
          ...o,
          id: ids.get(o.id) ?? fresh('o'),
          text: text(o.text),
          ...(o.lockedText ? { lockedText: text(o.lockedText) } : {}),
          then: list(o.then),
        })),
      };
    }
    case 'if':
      return {
        ...block,
        id,
        branches: block.branches.map((b) => ({ ...b, id: fresh('br'), then: list(b.then) })),
        ...(block.else ? { else: list(block.else) } : {}),
      };
    case 'check':
      return {
        ...block,
        id,
        ...(block.label ? { label: text(block.label) } : {}),
        success: list(block.success),
        fail: list(block.fail),
      };
    case 'fight':
      return { ...block, id, win: list(block.win), lose: list(block.lose) };
    case 'battle':
      return cloneBattle(block, id, list);
    case 'input':
      return { ...block, id, prompt: text(block.prompt) };
    case 'random':
      return {
        ...block,
        id,
        branches: block.branches.map((b) => ({ ...b, id: fresh('br'), then: list(b.then) })),
      };
    case 'end':
      return block.ending
        ? { ...block, id, ending: { id: fresh('e'), title: text(block.ending.title) } }
        : { ...block, id };
    default:
      return { ...block, id };
  }
}
