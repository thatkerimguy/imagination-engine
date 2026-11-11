import type { Value } from '@ie/core';
import { parseDice, successChance } from './dice.ts';
import { simpleRequirement, truthy, type Expr } from './formula.ts';
import type { ChoiceBlock, Formula } from './schema.ts';
import type { Mutable, OptionLock, OptionView } from './state.ts';

/** What an option needs to know about the running story to describe itself. */
export interface OptionContext {
  compute(formula: Formula): Value;
  num(id: string): number;
  timesChosen(optionId: string): number;
  formula(formula: Formula): Expr;
}

/**
 * How an option looks right now: hidden (null), enabled or locked with a reason, its cost and,
 * when the author asked, the odds of the check it leads to.
 */
export function optionView(
  choice: ChoiceBlock,
  optionId: string,
  ctx: OptionContext,
): OptionView | null {
  const option = choice.options.find((o) => o.id === optionId);
  if (!option) return null;
  if (option.visibleIf !== undefined && !truthy(ctx.compute(option.visibleIf))) return null;
  const timesChosen = ctx.timesChosen(option.id);
  if (option.once && timesChosen > 0) return null;

  const view: Mutable<OptionView> = { id: option.id, enabled: true, seen: timesChosen > 0 };
  if (option.cost) {
    const amount = Number(ctx.compute(option.cost.amount)) || 0;
    view.cost = { var: option.cost.var, amount };
    if (ctx.num(option.cost.var) < amount) {
      view.enabled = false;
      view.lock = { kind: 'cost' };
    }
  }
  if (option.enabledIf !== undefined && !truthy(ctx.compute(option.enabledIf))) {
    view.enabled = false;
    view.lock = lockFor(option.enabledIf, option.lockedText !== undefined, ctx);
  }
  const first = option.then[0];
  if (option.showOdds && first?.type === 'check') {
    const modifier = first.modifier === undefined ? 0 : Number(ctx.compute(first.modifier)) || 0;
    view.odds = successChance(
      parseDice(first.dice),
      modifier,
      Number(ctx.compute(first.target)) || 0,
    );
  }
  return view;
}

/**
 * Why something gated by `enabledIf` is locked: the author's own words, the requirement the
 * reader can be told ("Needs Strength 3"), or no explanation.
 */
export function lockFor(
  enabledIf: Formula,
  hasText: boolean,
  ctx: Pick<OptionContext, 'formula'>,
): OptionLock {
  if (hasText) return { kind: 'text' };
  const requirement = simpleRequirement(ctx.formula(enabledIf));
  return requirement ? { kind: 'requirement', requirement } : { kind: 'unknown' };
}

/** The timer of a timed choice; it falls back to the first enabled option if the default is locked. */
export function timerFor(
  block: ChoiceBlock,
  views: readonly OptionView[],
): { seconds: number; defaultOption: string } | undefined {
  const seconds = block.timer?.seconds ?? 0;
  const preferred = views.find((v) => v.id === block.timer?.default && v.enabled);
  const fallback = preferred ?? views.find((v) => v.enabled);
  return fallback ? { seconds, defaultOption: fallback.id } : undefined;
}
