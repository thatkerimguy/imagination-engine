import type { Locale, Translator } from '@ie/i18n';
import { formatValue, pickLabel, type CompiledStory, type RpgBeat } from '@ie/story';
import { variableLabel } from './labels.ts';
import type { PresentKey } from './messages.ts';

/** Display names of the RPG kit's data, in the reader's language. */
export const rpgNames = {
  item: (story: CompiledStory, id: string, locale: Locale) =>
    pickLabel(story.project.items?.find((i) => i.id === id)?.name, locale, id),
  skill: (story: CompiledStory, id: string, locale: Locale) =>
    pickLabel(story.project.skills?.find((s) => s.id === id)?.name, locale, id),
  enemy: (story: CompiledStory, id: string, locale: Locale) =>
    pickLabel(story.project.enemies?.find((e) => e.id === id)?.name, locale, id),
};

function battleEnemy(story: CompiledStory, blockId: string, locale: Locale): string {
  const block = story.blocks.get(blockId)?.block;
  return block?.type === 'battle' ? rpgNames.enemy(story, block.enemy, locale) : '';
}

function shopCurrency(story: CompiledStory, blockId: string, locale: Locale): string {
  const block = story.blocks.get(blockId)?.block;
  return block?.type === 'shop' ? variableLabel(story, block.currency, locale) : '';
}

/**
 * The words an RPG beat leaves on the page ("Received: Potion ×2"), with a tone for styling,
 * or null when the beat shows nothing (a shop opening, taking an item the reader didn't have).
 */
export function rpgLineText(
  beat: RpgBeat,
  story: CompiledStory,
  t: Translator<PresentKey>,
): { text: string; tone: 'gain' | 'loss' | 'info' } | null {
  const locale = t.locale;
  const n = (value: number) => formatValue(value, locale);
  switch (beat.kind) {
    case 'item': {
      if (beat.count <= 0) return null;
      const count = beat.count > 1 ? ` ${t('battle.count', { count: n(beat.count) })}` : '';
      const name = rpgNames.item(story, beat.item, locale);
      const key = beat.op === 'give' ? 'item.give' : beat.op === 'take' ? 'item.take' : 'item.use';
      return { text: t(key, { name, count }), tone: beat.op === 'give' ? 'gain' : 'info' };
    }
    case 'quest': {
      const quest = story.project.quests?.find((q) => q.id === beat.quest);
      const name = pickLabel(quest?.name, locale, beat.quest);
      if (beat.status === 'done') return { text: t('quest.done', { name }), tone: 'gain' };
      if (beat.status === 'failed') return { text: t('quest.failed', { name }), tone: 'loss' };
      const step = pickLabel(quest?.steps[beat.step]?.text, locale);
      return { text: t('quest.active', { name, step }), tone: 'info' };
    }
    case 'traded': {
      const params = {
        name: rpgNames.item(story, beat.item, locale),
        price: n(beat.price),
        currency: shopCurrency(story, beat.blockId, locale),
      };
      return { text: t(beat.sold ? 'shop.sold' : 'shop.bought', params), tone: 'info' };
    }
    case 'battle':
      return {
        text: t('battle.start', { enemy: battleEnemy(story, beat.blockId, locale) }),
        tone: 'loss',
      };
    case 'turn': {
      const enemy = battleEnemy(story, beat.blockId, locale);
      const amount = n(beat.amount);
      let text: string;
      if (beat.actor === 'enemy') text = t('battle.enemyHit', { enemy, amount });
      else if (beat.act === 'attack') text = t('battle.attack', { enemy, amount });
      else if (beat.act === 'flee') text = t(beat.amount > 0 ? 'battle.fled' : 'battle.fleeFailed');
      else if (beat.act === 'item') {
        const item = rpgNames.item(story, beat.id ?? '', locale);
        text =
          beat.amount > 0 ? t('battle.item', { item, amount }) : t('battle.itemUsed', { item });
      } else {
        const skill = rpgNames.skill(story, beat.id ?? '', locale);
        const heal = story.project.skills?.find((s) => s.id === beat.id)?.heal;
        text = heal
          ? t('battle.heal', { skill, amount })
          : t('battle.skill', { skill, amount, enemy });
      }
      if (beat.crit) text = t('battle.crit', { text });
      return { text, tone: beat.actor === 'enemy' ? 'loss' : 'gain' };
    }
    case 'battled': {
      const enemy = battleEnemy(story, beat.blockId, locale);
      const key =
        beat.outcome === 'won'
          ? 'battle.won'
          : beat.outcome === 'lost'
            ? 'battle.lost'
            : 'battle.escaped';
      return { text: t(key, { enemy }), tone: beat.outcome === 'lost' ? 'loss' : 'gain' };
    }
    case 'shop':
      return null;
  }
}
