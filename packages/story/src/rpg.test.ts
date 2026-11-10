import { describe, expect, it } from 'vitest';
import { checkStory, compileStory } from './compile.ts';
import { endBlock, lines, playOn, rpg, run, say } from './rpg.fixture.ts';
import { StoryRuntime } from './runtime.ts';
import type { Block } from './schema.ts';

describe('items and quests', () => {
  it('gives, takes and uses items, and formulas read them', () => {
    const rt = run(
      rpg([
        { id: 'g', type: 'item', op: 'give', item: 'potion', count: 3 },
        { id: 'k', type: 'item', op: 'give', item: 'key' },
        { id: 's1', type: 'set', var: 'hp', value: 5 },
        { id: 'u', type: 'item', op: 'use', item: 'potion' },
        { id: 'tk', type: 'item', op: 'take', item: 'key', count: 4 },
        {
          id: 'if',
          type: 'if',
          branches: [{ id: 'br', when: 'owned("potion") == 2', then: [say('Two left at {hp}.')] }],
        },
        endBlock(),
      ]),
    );
    playOn(rt);
    expect(rt.inventory).toEqual({ potion: 2 });
    expect(rt.value('hp')).toBe(15);
    expect(lines(rt)).toEqual(['Two left at 15.']);
    const items = rt.log.filter((b) => b.kind === 'item');
    expect(items.map((b) => b.kind === 'item' && [b.op, b.count])).toEqual([
      ['give', 3],
      ['give', 1],
      ['use', 1],
      ['take', 1],
    ]);
  });

  it('caps healing at max HP', () => {
    const rt = run(
      rpg([
        { id: 'g', type: 'item', op: 'give', item: 'potion' },
        { id: 'u', type: 'item', op: 'use', item: 'potion' },
        say('{hp}'),
      ]),
    );
    playOn(rt);
    expect(rt.value('hp')).toBe(30);
  });

  it('moves a quest through its steps', () => {
    const rt = run(
      rpg([
        { id: 'q1', type: 'quest', op: 'start', quest: 'lost' },
        say('Started.'),
        { id: 'q2', type: 'quest', op: 'step', quest: 'lost', step: 'bring' },
        {
          id: 'if',
          type: 'if',
          branches: [{ id: 'br', when: 'quest("lost") == "active"', then: [say('Active.')] }],
        },
        { id: 'q3', type: 'quest', op: 'done', quest: 'lost' },
        say('{hp}'),
        endBlock(),
      ]),
    );
    rt.advance();
    expect(rt.quests).toEqual({ lost: { status: 'active', step: 0 } });
    playOn(rt);
    expect(lines(rt)).toContain('Active.');
    expect(rt.quests).toEqual({ lost: { status: 'done', step: 1 } });
  });

  it('reports unknown items, quests and steps', () => {
    const codes = checkStory(
      rpg([
        { id: 'a', type: 'item', op: 'give', item: 'sword' },
        { id: 'b', type: 'quest', op: 'step', quest: 'lost', step: 'nope' },
        { id: 'c', type: 'quest', op: 'start', quest: 'ghost' },
        { id: 'd', type: 'if', branches: [{ id: 'br', when: 'owned("gem") > 0', then: [] }] },
        endBlock(),
      ]),
    ).map((p) => p.code);
    expect(codes).toEqual(
      expect.arrayContaining(['unknown-item', 'unknown-step', 'unknown-quest']),
    );
    expect(codes.filter((c) => c === 'unknown-item')).toHaveLength(2);
  });
});

describe('shops', () => {
  const shop: Block = {
    id: 'shop',
    type: 'shop',
    currency: 'gold',
    stock: [{ item: 'potion' }, { item: 'key', price: 50 }],
    sells: true,
  };

  it('waits while the reader buys and sells, then goes on', () => {
    const rt = run(rpg([shop, say('Bye.'), endBlock()]));
    rt.advance();
    expect(rt.waiting?.kind).toBe('shop');
    const menu = rt.shopMenu();
    expect(menu?.stock).toEqual([
      { item: 'potion', price: 6, affordable: true },
      { item: 'key', price: 50, affordable: false },
    ]);
    rt.buy('potion');
    rt.buy('potion');
    expect(rt.advance().map((b) => b.kind)).toEqual(['traded', 'traded']);
    expect(rt.value('gold')).toBe(8);
    expect(() => rt.buy('key')).toThrow();
    expect(rt.shopMenu()?.sell).toEqual([{ item: 'potion', price: 3, count: 2 }]);
    rt.sell('potion');
    expect(rt.value('gold')).toBe(11);
    expect(rt.inventory).toEqual({ potion: 1 });
    expect(rt.waiting?.kind).toBe('shop');
    rt.leaveShop();
    rt.advance();
    expect(lines(rt)).toEqual(['Bye.']);
  });

  it('survives a snapshot taken mid-shop', () => {
    const rt = run(rpg([shop, say('Bye.'), endBlock()]));
    rt.advance();
    rt.buy('potion');
    const copy = new StoryRuntime(rt.story, { state: rt.snapshot() });
    expect(copy.waiting?.kind).toBe('shop');
    expect(copy.inventory).toEqual({ potion: 1 });
  });
});

describe('battles', () => {
  const battle = (extra: Partial<Extract<Block, { type: 'battle' }>> = {}): Block => ({
    id: 'fight',
    type: 'battle',
    enemy: 'rat',
    flee: true,
    win: [say('Won.'), endBlock()],
    lose: [say('Lost.'), endBlock()],
    fled: [say('Fled.'), endBlock()],
    ...extra,
  });

  it('trades blows until someone falls, the same way for the same seed', () => {
    const story = compileStory(rpg([battle()]));
    const play = () => {
      const rt = new StoryRuntime(story, { seed: 3 });
      rt.advance();
      expect(rt.waiting?.kind).toBe('battle');
      for (let i = 0; i < 50 && rt.waiting?.kind === 'battle'; i++) {
        rt.battleAction({ act: 'attack' });
        rt.advance();
      }
      return rt;
    };
    const a = play();
    const b = play();
    expect(a.log).toEqual(b.log);
    expect(lines(a)).toEqual(['Won.']);
    const turns = a.log.filter((x) => x.kind === 'turn');
    expect(turns.every((x) => x.kind === 'turn' && x.amount >= 1)).toBe(true);
    expect(a.log.some((x) => x.kind === 'battled' && x.outcome === 'won')).toBe(true);
    expect(a.battleMenu()).toBeNull();
  });

  it('loses when the hero falls', () => {
    const rt = run(rpg([{ id: 's', type: 'set', var: 'hp', value: 1 }, battle({ flee: false })]));
    rt.advance();
    rt.battleAction({ act: 'attack' });
    rt.advance();
    expect(lines(rt)).toEqual(['Lost.']);
  });

  it('offers skills and items, spends MP, heals, and hides locked skills', () => {
    const rt = run(
      rpg([
        { id: 'g', type: 'item', op: 'give', item: 'potion' },
        { id: 's', type: 'set', var: 'hp', value: 12 },
        battle(),
      ]),
    );
    rt.advance();
    const menu = rt.battleMenu();
    expect(menu?.skills).toEqual([
      { id: 'heal', cost: 2, enabled: true },
      { id: 'smite', cost: 3, enabled: true },
    ]);
    expect(menu?.items).toEqual([{ id: 'potion', count: 1 }]);
    rt.battleAction({ act: 'skill', id: 'heal' });
    const heal = rt.advance().find((x) => x.kind === 'turn' && x.actor === 'hero');
    expect(heal).toMatchObject({ act: 'skill', id: 'heal', amount: 15 });
    expect(rt.value('mp')).toBe(3);
    expect(rt.battleMenu()?.skills.find((s) => s.id === 'smite')?.enabled).toBe(true);
    rt.battleAction({ act: 'skill', id: 'smite' });
    expect(rt.value('mp')).toBe(0);
    expect(rt.battleMenu()?.skills.every((s) => !s.enabled)).toBe(true);
    expect(() => rt.battleAction({ act: 'skill', id: 'heal' })).toThrow();
  });

  it('can flee into the fled list', () => {
    const rt = run(rpg([battle()]), 11);
    rt.advance();
    for (let i = 0; i < 30 && rt.waiting?.kind === 'battle'; i++) {
      rt.battleAction({ act: 'flee' });
      rt.advance();
    }
    expect(lines(rt).at(-1)).toMatch(/Fled|Lost/);
  });

  it('keeps a battle in a save', () => {
    const rt = run(rpg([battle()]));
    rt.advance();
    rt.battleAction({ act: 'attack' });
    rt.advance();
    const copy = new StoryRuntime(rt.story, { state: rt.snapshot() });
    expect(copy.battleMenu()?.enemyHp).toBe(rt.battleMenu()?.enemyHp);
    expect(copy.battleMenu()?.round).toBe(1);
  });

  it('needs the hero settings', () => {
    const codes = checkStory(rpg([battle()], { hero: {} })).map((p) => p.code);
    expect(codes).toContain('hero-missing');
  });
});
