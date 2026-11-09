import { localeTag, type Locale, type Translator } from '@ie/i18n';
import { formatValue, type Beat, type CompiledStory, type OptionLock } from '@ie/story';
import type { PresentKey } from './messages.ts';

export type CheckBeat = Extract<Beat, { kind: 'check' }>;

/** A variable's display name in the reader's language. */
export function variableLabel(story: CompiledStory, id: string, locale: Locale): string {
  const name = story.variables.get(id)?.name;
  return name?.[locale] || name?.en || name?.tr || id;
}

/**
 * Why an option can't be picked, in words ("Requires Charisma 6"). `lockedText` is the author's
 * own explanation, already rendered; it wins over anything generated.
 */
export function lockText(
  lock: OptionLock,
  story: CompiledStory,
  t: Translator<PresentKey>,
  lockedText: string | undefined,
  costVar?: string,
): string {
  const locale = t.locale;
  if (lock.kind === 'text' && lockedText) return lockedText;
  if (lock.kind === 'cost' && costVar)
    return t('lock.cost', { label: variableLabel(story, costVar, locale) });
  if (lock.kind !== 'requirement') return t('lock.unknown');
  const { requirement } = lock;
  const label = variableLabel(story, requirement.var, locale);
  const { op, value } = requirement;
  if (typeof value === 'number') {
    if (op === '>=' || op === '>')
      return t('lock.atLeast', { label, value: op === '>' ? value + 1 : value });
    if (op === '<=' || op === '<')
      return t('lock.atMost', { label, value: op === '<' ? value - 1 : value });
  }
  if (op === '==' && value === true) return t('lock.flag', { label });
  if (op === '==' && value !== false && value !== null)
    return t('lock.equals', { label, value: formatValue(value, locale) });
  return t('lock.unknown');
}

const percentFormats = new Map<Locale, Intl.NumberFormat>();

/** Chance of success as a whole percentage, never claiming 0% or 100% for a real gamble. */
export function oddsText(odds: number, locale: Locale): string {
  let format = percentFormats.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(localeTag(locale), {
      style: 'percent',
      maximumFractionDigits: 0,
    });
    percentFormats.set(locale, format);
  }
  const rounded = Math.round(odds * 100) / 100;
  const shown = odds > 0 && rounded === 0 ? 0.01 : odds < 1 && rounded === 1 ? 0.99 : rounded;
  return format.format(shown);
}

/** What an option costs ("−10 Gold"). */
export function costText(
  cost: { readonly var: string; readonly amount: number },
  story: CompiledStory,
  t: Translator<PresentKey>,
): string {
  return t('choice.cost', {
    amount: `−${formatValue(cost.amount, t.locale)}`,
    label: variableLabel(story, cost.var, t.locale),
  });
}

/** A dice check's outcome ("Agility roll: 15, needed 12 · Success"). */
export function checkText(
  beat: CheckBeat,
  label: string | undefined,
  t: Translator<PresentKey>,
): string {
  const total = beat.rolls.reduce((sum, roll) => sum + roll, 0) + beat.modifier;
  const roll = label
    ? t('check.labelled', { label, total, target: beat.target })
    : t('check.plain', { total, target: beat.target });
  return `${roll} · ${t(beat.success ? 'check.success' : 'check.fail')}`;
}

/** Every distinct ending in the story, for "Endings found: 2 of 6". */
export function endingIds(story: CompiledStory): string[] {
  const ids = new Set<string>();
  for (const { block } of story.blocks.values()) {
    if (block.type === 'end' && block.ending) ids.add(block.ending.id);
  }
  return [...ids];
}
