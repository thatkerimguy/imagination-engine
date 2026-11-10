import { compileStory, ENDINGS_KEY, nextRandom, StoryRuntime } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { samples } from './index.ts';

/** A tiny auto-playtester: random choices, until the story ends. */
function playthrough(seed: number) {
  const story = compileStory(samples.rainAlley);
  const runtime = new StoryRuntime(story, { seed });
  let pick = seed;
  for (let steps = 0; steps < 500; steps++) {
    const beat = runtime.advance().at(-1) ?? runtime.waiting;
    if (!beat || beat.kind === 'end')
      return { runtime, ending: beat?.kind === 'end' ? beat.endingId : undefined };
    if (beat.kind === 'choice') {
      const open = beat.options.filter((o) => o.enabled);
      const roll = nextRandom(pick);
      pick = roll.state;
      runtime.choose(open[Math.floor(roll.value * open.length)]?.id ?? '');
    } else if (beat.kind === 'input') {
      runtime.submit(seed % 2 ? 'Ayşe' : '');
    } else if (beat.kind === 'fight') {
      const roll = nextRandom(pick);
      pick = roll.state;
      runtime.resolveFight({ won: roll.value < 0.5, score: Math.round(roll.value * 100) });
    } else if (beat.kind === 'shop' || beat.kind === 'traded') {
      // Buy something affordable at random, one at a time, then leave.
      const offers = runtime.shopMenu()?.stock.filter((s) => s.affordable) ?? [];
      const roll = nextRandom(pick);
      pick = roll.state;
      const offer = offers[Math.floor(roll.value * offers.length)];
      if (offer && roll.value < 0.7) runtime.buy(offer.item);
      else runtime.leaveShop();
    } else if (runtime.battleMenu()) {
      const menu = runtime.battleMenu();
      const roll = nextRandom(pick);
      pick = roll.state;
      const skill = menu?.skills.find((s) => s.enabled);
      const item = menu?.items[0];
      if (menu?.flee && roll.value < 0.1) runtime.battleAction({ act: 'flee' });
      else if (skill && roll.value < 0.4) runtime.battleAction({ act: 'skill', id: skill.id });
      else if (item && roll.value < 0.5) runtime.battleAction({ act: 'item', id: item.id });
      else runtime.battleAction({ act: 'attack' });
    }
  }
  throw new Error(`Seed ${seed} never reached an ending.`);
}

describe('The Rain Alley sample', () => {
  it('has a night market with a shop, a battle, a quest, a rule and a routine', () => {
    let saw = { shop: false, battle: false, lantern: false, quest: false };
    for (let seed = 1; seed <= 300; seed++) {
      const { runtime } = playthrough(seed);
      const log = runtime.log;
      saw = {
        shop: saw.shop || log.some((b) => b.kind === 'traded'),
        battle: saw.battle || log.some((b) => b.kind === 'battled'),
        lantern: saw.lantern || (runtime.inventory.lantern ?? 0) > 0,
        quest: saw.quest || runtime.quests.stranger?.status === 'done',
      };
    }
    expect(saw).toEqual({ shop: true, battle: true, lantern: true, quest: true });
  });

  it('loads without errors or warnings', () => {
    const story = compileStory(samples.rainAlley);
    expect(story.problems).toEqual([]);
    expect(story.project.languages).toEqual(['en', 'tr']);
  });

  it('always reaches an ending, and every ending is reachable', () => {
    const endings = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const { runtime, ending } = playthrough(seed);
      expect(ending).toBeDefined();
      endings.add(ending ?? '');
      expect(runtime.persistentValues[ENDINGS_KEY]).toEqual([ending]);
    }
    expect([...endings].sort()).toEqual([
      'dark',
      'duelist',
      'family',
      'frozen',
      'scar',
      'victory',
      'words',
    ]);
  });
});
