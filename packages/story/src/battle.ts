import { listKey } from './compile.ts';
import type { EnemyDef } from './fight.ts';
import { truthy } from './formula.ts';
import { addTo, owned, useItem } from './rpg-run.ts';
import type { BattleBlock, HeroDef, SkillDef } from './rpg.ts';
import type { RuntimeCore } from './runtime-core.ts';
import type { BattleAct, BattleOutcome } from './state-rpg.ts';

/*
 * Turn-based battles (ADR 0017). The reader acts, the enemy answers, and every turn leaves a beat.
 * All randomness comes from the story's seeded generator, so a battle replays exactly.
 */

const DEFAULT_ENEMY_HP = 100;
const DEFAULT_ENEMY_ATTACK = 10;
const CRIT_CHANCE = 0.1;
const FLEE_CHANCE = 0.5;

export interface BattleAction {
  readonly act: BattleAct;
  /** The skill or item. */
  readonly id?: string;
}

export interface BattleMenu {
  readonly blockId: string;
  readonly enemy: EnemyDef;
  readonly enemyHp: number;
  readonly enemyMaxHp: number;
  readonly round: number;
  readonly heroHp: number;
  readonly heroMaxHp: number | null;
  readonly mp: number | null;
  readonly skills: readonly { id: string; cost: number; enabled: boolean }[];
  /** Consumables the reader carries. */
  readonly items: readonly { id: string; count: number }[];
  readonly flee: boolean;
}

interface Battle {
  readonly block: BattleBlock;
  readonly enemy: EnemyDef;
  readonly hero: HeroDef;
}

function current(core: RuntimeCore): Battle | null {
  const state = core.s.battle;
  if (!state) return null;
  const info = core.story.blocks.get(state.blockId);
  if (info?.block.type !== 'battle') return null;
  const block = info.block;
  const enemy = core.story.project.enemies?.find((e) => e.id === block.enemy);
  return enemy ? { block, enemy, hero: core.story.project.hero ?? {} } : null;
}

export function startBattle(core: RuntimeCore, block: BattleBlock): true {
  const enemy = core.story.project.enemies?.find((e) => e.id === block.enemy);
  core.s.battle = { blockId: block.id, enemyHp: enemy?.hp ?? DEFAULT_ENEMY_HP, round: 0 };
  return core.wait({ kind: 'battle', blockId: block.id });
}

function skillUsable(core: RuntimeCore, skill: SkillDef, hero: HeroDef): boolean {
  if (skill.requires !== undefined && !truthy(core.compute(skill.requires))) return false;
  const cost = skill.cost ?? 0;
  return cost === 0 || (hero.mp !== undefined && core.num(hero.mp) >= cost);
}

export function battleMenu(core: RuntimeCore): BattleMenu | null {
  const battle = current(core);
  const state = core.s.battle;
  if (!battle || !state) return null;
  const { block, enemy, hero } = battle;
  return {
    blockId: block.id,
    enemy,
    enemyHp: state.enemyHp,
    enemyMaxHp: enemy.hp ?? DEFAULT_ENEMY_HP,
    round: state.round,
    heroHp: hero.hp ? core.num(hero.hp) : 0,
    heroMaxHp: hero.maxHp ? core.num(hero.maxHp) : null,
    mp: hero.mp ? core.num(hero.mp) : null,
    // A skill hidden by `requires` isn't listed at all; one the reader can't pay for is greyed.
    skills: (core.story.project.skills ?? [])
      .filter((s) => s.requires === undefined || truthy(core.compute(s.requires)))
      .map((s) => ({ id: s.id, cost: s.cost ?? 0, enabled: skillUsable(core, s, hero) })),
    items: (core.story.project.items ?? [])
      .filter((i) => i.kind === 'consumable' && owned(core, i.id) > 0)
      .map((i) => ({ id: i.id, count: owned(core, i.id) })),
    flee: block.flee ?? false,
  };
}

/** Seeded damage: attack × power, ±15%, less half the defense, at least 1; 10% crits for ×1.5. */
function strike(core: RuntimeCore, attack: number, power: number, defense: number) {
  const spread = 0.85 + core.randomFloat() * 0.3;
  const crit = core.randomFloat() < CRIT_CHANCE;
  const base = Math.max(1, Math.round(attack * power * spread - defense * 0.5));
  return { amount: crit ? Math.round(base * 1.5) : base, crit };
}

/** The reader's move, then the enemy's answer, unless the battle ended first. */
export function battleAction(core: RuntimeCore, action: BattleAction): void {
  const battle = current(core);
  const state = core.s.battle;
  if (!battle || !state || core.waiting?.kind !== 'battle')
    throw new Error('There is no battle waiting.');
  const { block, enemy, hero } = battle;
  const turn = { kind: 'turn', blockId: block.id, actor: 'hero', act: action.act } as const;
  let enemyHp = state.enemyHp;

  switch (action.act) {
    case 'attack': {
      const hit = strike(core, heroStat(core, hero.attack), 1, enemy.defense ?? 0);
      enemyHp -= hit.amount;
      core.record({ ...turn, amount: hit.amount, crit: hit.crit });
      break;
    }
    case 'skill': {
      const skill = core.story.project.skills?.find((s) => s.id === action.id);
      if (!skill || !skillUsable(core, skill, hero))
        throw new Error(`The skill "${action.id}" can't be used now.`);
      if (hero.mp && skill.cost) addTo(core, hero.mp, -skill.cost);
      if (skill.heal) {
        const before = heroStat(core, hero.hp);
        const max = hero.maxHp ? core.num(hero.maxHp) : DEFAULT_ENEMY_HP;
        if (hero.hp) addTo(core, hero.hp, Math.round(max * (skill.power ?? 0.3)));
        core.record({ ...turn, id: skill.id, amount: heroStat(core, hero.hp) - before });
      } else {
        const hit = strike(
          core,
          heroStat(core, hero.attack),
          skill.power ?? 1.5,
          enemy.defense ?? 0,
        );
        enemyHp -= hit.amount;
        core.record({ ...turn, id: skill.id, amount: hit.amount, crit: hit.crit });
      }
      break;
    }
    case 'item': {
      const item = core.story.project.items?.find((i) => i.id === action.id);
      if (!item || item.kind !== 'consumable' || owned(core, item.id) === 0)
        throw new Error(`The item "${action.id}" can't be used now.`);
      const before = heroStat(core, hero.hp);
      useItem(core, item.id, 1);
      core.record({ ...turn, id: item.id, amount: heroStat(core, hero.hp) - before });
      break;
    }
    case 'flee': {
      if (!block.flee) throw new Error("This battle can't be fled.");
      const escaped = core.randomFloat() < FLEE_CHANCE;
      core.record({ ...turn, amount: escaped ? 1 : 0 });
      if (escaped) return end(core, block, 'fled');
      break;
    }
  }

  if (enemyHp <= 0) return end(core, block, 'won');
  const hit = strike(core, enemy.attack ?? DEFAULT_ENEMY_ATTACK, 1, heroStat(core, hero.defense));
  if (hero.hp) addTo(core, hero.hp, -hit.amount);
  core.record({ ...turn, actor: 'enemy', act: 'attack', amount: hit.amount, crit: hit.crit });
  if (heroStat(core, hero.hp) <= 0) return end(core, block, 'lost');
  core.s.battle = { ...state, enemyHp, round: state.round + 1 };
}

function heroStat(core: RuntimeCore, id: string | undefined): number {
  return id ? core.num(id) : 0;
}

function end(core: RuntimeCore, block: BattleBlock, outcome: BattleOutcome): void {
  delete core.s.battle;
  core.s.waiting = null;
  core.record({ kind: 'battled', blockId: block.id, outcome });
  if (outcome === 'won') core.push({ list: listKey.win(block.id), index: 0 });
  else if (outcome === 'lost') core.push({ list: listKey.lose(block.id), index: 0 });
  else if (block.fled) core.push({ list: listKey.fled(block.id), index: 0 });
}
