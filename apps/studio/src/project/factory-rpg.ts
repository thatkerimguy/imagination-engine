import { createId } from '@ie/core';
import type {
  Block,
  ItemDef,
  Label,
  QuestDef,
  RoutineDef,
  RpgBlock,
  RoutineBlock,
  RuleDef,
  SkillDef,
  StoryProject,
  VariableDef,
} from '@ie/story';

/*
 * New RPG data and blocks (ADR 0017), each valid as soon as it is made.
 */

export const RPG_BLOCKS = ['item', 'quest', 'shop', 'battle', 'routine'] as const;
export type RpgBlockType = (typeof RPG_BLOCKS)[number];

export interface RpgDefaults {
  readonly item?: string;
  readonly quest?: string;
  readonly enemy?: string;
  readonly routine?: string;
  /** A number variable for a shop's money. */
  readonly currency?: string;
}

export function newRpgBlock(
  type: RpgBlockType,
  id: string,
  d: RpgDefaults,
): RpgBlock | RoutineBlock {
  switch (type) {
    case 'item':
      return { id, type, op: 'give', item: d.item ?? '' };
    case 'quest':
      return { id, type, op: 'start', quest: d.quest ?? '' };
    case 'shop':
      return { id, type, currency: d.currency ?? '', stock: d.item ? [{ item: d.item }] : [] };
    case 'battle':
      return { id, type, enemy: d.enemy ?? '', win: [], lose: [] };
    case 'routine':
      return { id, type, routine: d.routine ?? '' };
  }
}

export function newItem(name: Label): ItemDef {
  return { id: createId('it'), name, kind: 'item', price: 10 };
}

export function newSkill(name: Label): SkillDef {
  return { id: createId('sk'), name, cost: 2, power: 1.5 };
}

export function newQuest(name: Label, step: Label): QuestDef {
  return { id: createId('q'), name, steps: [{ id: createId('st'), text: step }] };
}

export function newRule(name: string): RuleDef {
  return { id: createId('r'), name, on: 'entered', do: [] };
}

export function newRoutine(name: string): RoutineDef {
  return { id: createId('u'), name, params: [], blocks: [] };
}

const HERO_STATS = [
  ['hp', { en: 'HP', tr: 'Can' }, 30],
  ['maxHp', { en: 'Max HP', tr: 'En yüksek can' }, 30],
  ['attack', { en: 'Attack', tr: 'Saldırı' }, 6],
  ['defense', { en: 'Defense', tr: 'Savunma' }, 2],
  ['mp', { en: 'MP', tr: 'MP' }, 5],
] as const;

/**
 * The variable a new shop takes payment in: the first number that isn't one of the hero's battle
 * stats, so a shop never defaults to charging HP. Falls back to any number variable.
 */
export function currencyFor(doc: StoryProject): string | undefined {
  const numbers = doc.variables.filter((v) => v.type === 'number');
  const hero = new Set(Object.values(doc.hero ?? {}));
  return (numbers.find((v) => !hero.has(v.id)) ?? numbers[0])?.id;
}

/** Adds the hero's five stat variables (HP, max HP, attack, defense, MP) and points Hero at them. */
export function withHeroStats(doc: StoryProject): StoryProject {
  const variables: VariableDef[] = [...doc.variables];
  const hero: Record<string, string> = { ...doc.hero };
  for (const [key, name, value] of HERO_STATS) {
    if (hero[key]) continue;
    const variable: VariableDef = {
      id: createId('v'),
      name,
      type: 'number',
      scope: 'game',
      default: value,
      min: 0,
      stat: true,
    };
    variables.push(variable);
    hero[key] = variable.id;
  }
  return { ...doc, variables, hero };
}

/** Fresh IDs for a copied battle's lists are made by the caller's cloneBlock. */
export function cloneBattle(
  block: Extract<Block, { type: 'battle' }>,
  id: string,
  list: (blocks: readonly Block[]) => Block[],
): Block {
  return {
    ...block,
    id,
    win: list(block.win),
    lose: list(block.lose),
    ...(block.fled ? { fled: list(block.fled) } : {}),
  };
}
