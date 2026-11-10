import type { Value } from '@ie/core';
import { listKey } from './compile.ts';
import { truthy, valueText } from './formula.ts';
import type { RoutineBlock } from './logic.ts';
import type { ItemBlock, QuestBlock, ShopBlock } from './rpg.ts';
import type { RuntimeCore } from './runtime-core.ts';
import type { QuestStatus } from './state-rpg.ts';

/*
 * Inventory, quests, shops and routines (ADR 0017). Battles are in battle.ts.
 */

export function owned(core: RuntimeCore, item: string): number {
  return core.s.inv?.[item] ?? 0;
}

function setCount(core: RuntimeCore, item: string, count: number): void {
  const inv = { ...core.s.inv };
  if (count > 0) inv[item] = count;
  else delete inv[item];
  core.s.inv = inv;
}

export function gain(core: RuntimeCore, item: string, count: number): void {
  if (count <= 0) return;
  setCount(core, item, owned(core, item) + count);
  core.raise('gained', item);
}

/** Takes up to `count`; returns how many were taken. */
export function lose(core: RuntimeCore, item: string, count: number): number {
  const taken = Math.min(owned(core, item), Math.max(0, count));
  if (taken > 0) {
    setCount(core, item, owned(core, item) - taken);
    core.raise('lost', item);
  }
  return taken;
}

/** Adds to a number variable; the hero's HP never goes past max HP. */
export function addTo(core: RuntimeCore, id: string, amount: number): void {
  const hero = core.story.project.hero;
  let next = core.num(id) + amount;
  if (hero?.hp === id && hero.maxHp) next = Math.min(next, core.num(hero.maxHp));
  core.write(id, next);
}

/** Uses up to `count` of an item, applying its effects for each; returns how many were used. */
export function useItem(core: RuntimeCore, item: string, count: number): number {
  const used = lose(core, item, count);
  const def = core.story.project.items?.find((i) => i.id === item);
  for (const effect of def?.effects ?? []) addTo(core, effect.var, effect.amount * used);
  return used;
}

export function runItem(core: RuntimeCore, block: ItemBlock): void {
  const wanted =
    block.count === undefined ? 1 : Math.max(0, Math.floor(Number(core.compute(block.count)) || 0));
  let count = wanted;
  if (block.op === 'give') gain(core, block.item, wanted);
  else if (block.op === 'take') count = lose(core, block.item, wanted);
  else count = useItem(core, block.item, wanted);
  core.record({ kind: 'item', blockId: block.id, item: block.item, op: block.op, count });
}

export function runQuest(core: RuntimeCore, block: QuestBlock): void {
  const def = core.story.project.quests?.find((q) => q.id === block.quest);
  if (!def) return;
  const current = core.s.quests?.[def.id];
  const stepIndex = Math.max(
    0,
    def.steps.findIndex((s) => s.id === block.step),
  );
  const status: QuestStatus =
    block.op === 'done' ? 'done' : block.op === 'fail' ? 'failed' : 'active';
  const step =
    block.op === 'step' || (block.op === 'start' && block.step) ? stepIndex : (current?.step ?? 0);
  core.s.quests = { ...core.s.quests, [def.id]: { status, step } };
  core.raise('quest', def.id);
  core.record({ kind: 'quest', blockId: block.id, quest: def.id, status, step });
}

/** Runs a routine behind a call boundary, its inputs computed in the caller's context. */
export function runRoutine(core: RuntimeCore, block: RoutineBlock): void {
  const routine = core.story.project.routines?.find((r) => r.id === block.routine);
  if (!routine) return;
  const locals: Record<string, Value> = {};
  for (const param of routine.params ?? []) {
    const formula = block.args?.[param.id];
    const raw = formula === undefined ? null : core.compute(formula);
    locals[param.id] =
      param.type === 'number'
        ? Number(raw) || 0
        : param.type === 'bool'
          ? truthy(raw)
          : valueText(raw);
  }
  core.push({ list: '', index: 0, call: true });
  core.push({ list: listKey.routine(routine.id), index: 0, locals });
}

// --- shops -------------------------------------------------------------------------------

export interface ShopMenu {
  readonly blockId: string;
  readonly currency: string;
  readonly money: number;
  readonly stock: readonly { item: string; price: number; affordable: boolean }[];
  /** What the reader can sell here, and for how much each. */
  readonly sell: readonly { item: string; price: number; count: number }[];
}

function waitingShop(core: RuntimeCore): ShopBlock | null {
  const beat = core.waiting;
  if (beat?.kind !== 'shop') return null;
  const info = core.story.blocks.get(beat.blockId);
  return info?.block.type === 'shop' ? info.block : null;
}

function basePrice(core: RuntimeCore, shop: ShopBlock, item: string): number {
  const stocked = shop.stock.find((s) => s.item === item)?.price;
  return stocked ?? core.story.project.items?.find((i) => i.id === item)?.price ?? 0;
}

export function shopMenu(core: RuntimeCore): ShopMenu | null {
  const shop = waitingShop(core);
  if (!shop) return null;
  const money = core.num(shop.currency);
  const items = core.story.project.items ?? [];
  return {
    blockId: shop.id,
    currency: shop.currency,
    money,
    stock: shop.stock.map((s) => {
      const price = basePrice(core, shop, s.item);
      return { item: s.item, price, affordable: money >= price };
    }),
    sell: shop.sells
      ? items
          .filter((i) => i.kind !== 'key' && owned(core, i.id) > 0)
          .map((i) => ({
            item: i.id,
            price: Math.floor(basePrice(core, shop, i.id) / 2),
            count: owned(core, i.id),
          }))
      : [],
  };
}

export function buy(core: RuntimeCore, item: string): void {
  const shop = waitingShop(core);
  const offer = shopMenu(core)?.stock.find((s) => s.item === item);
  if (!shop || !offer) throw new Error(`"${item}" isn't for sale here.`);
  if (!offer.affordable) throw new Error(`"${item}" costs more than the reader has.`);
  core.write(shop.currency, core.num(shop.currency) - offer.price);
  gain(core, item, 1);
  core.record({ kind: 'traded', blockId: shop.id, item, price: offer.price, sold: false });
}

export function sell(core: RuntimeCore, item: string): void {
  const shop = waitingShop(core);
  const offer = shopMenu(core)?.sell.find((s) => s.item === item);
  if (!shop || !offer) throw new Error(`"${item}" can't be sold here.`);
  lose(core, item, 1);
  core.write(shop.currency, core.num(shop.currency) + offer.price);
  core.record({ kind: 'traded', blockId: shop.id, item, price: offer.price, sold: true });
}

export function leaveShop(core: RuntimeCore): void {
  if (!waitingShop(core)) throw new Error('There is no shop open.');
  core.s.waiting = null;
}
