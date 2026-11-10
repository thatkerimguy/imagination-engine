import { describe, expect, it } from 'vitest';
import { checkStory } from './compile.ts';
import { endBlock, lines, playOn, rpg, run, say } from './rpg.fixture.ts';
import type { Block } from './schema.ts';

describe('rules', () => {
  it('fires when a variable changes, in rule order, and not on itself', () => {
    const rt = run(
      rpg(
        [
          { id: 's1', type: 'set', var: 'xp', op: 'add', value: 10 },
          say('After {level}.'),
          endBlock(),
        ],
        {
          rules: [
            {
              id: 'levelUp',
              on: 'changed',
              target: 'xp',
              if: 'xp >= 10',
              do: [
                { id: 'r1', type: 'set', var: 'level', op: 'add', value: 1 },
                { id: 'r2', type: 'set', var: 'xp', value: 0 },
                say('Level {level}!'),
              ],
            },
            { id: 'note', on: 'changed', target: 'level', do: [say('Noted.')] },
          ],
        },
      ),
    );
    playOn(rt);
    expect(lines(rt)).toEqual(['Noted.', 'Level 2!', 'After 2.']);
  });

  it('fires on entering a passage, on items and quests, and once rules only once', () => {
    const project = rpg([say('Hello.'), { id: 'j', type: 'jump', to: 'start' }], {
      rules: [
        { id: 'greet', on: 'entered', target: 'start', once: true, do: [say('First time.')] },
        { id: 'every', on: 'entered', do: [{ id: 'g', type: 'item', op: 'give', item: 'potion' }] },
        { id: 'got', on: 'gained', target: 'potion', do: [say('Got {gold}.')] },
      ],
    });
    const rt = run(project);
    rt.advance();
    rt.advance();
    rt.advance();
    rt.advance();
    expect(lines(rt)).toEqual(['First time.', 'Got 20.', 'Hello.', 'Got 20.']);
  });

  it('warns about a rule listening for something missing', () => {
    const codes = checkStory(
      rpg([say('Hi.'), endBlock()], {
        rules: [{ id: 'x', on: 'changed', target: 'nothing', do: [] }],
      }),
    ).map((p) => p.code);
    expect(codes).toContain('rule-target');
  });
});

describe('routines', () => {
  const routines = [
    {
      id: 'reward',
      name: 'Reward',
      params: [
        { id: 'amount', name: { en: 'Amount', tr: 'Miktar' }, type: 'number' as const },
        { id: 'who', name: { en: 'Who', tr: 'Kim' }, type: 'text' as const },
      ],
      blocks: [
        { id: 'ra', type: 'set', var: 'amount', op: 'add', value: 'amount' },
        { id: 'rb', type: 'set', var: 'gold', op: 'add', value: 'amount' },
        say('{who} pays {amount}.'),
        { id: 'rr', type: 'return' },
        say('Never.'),
      ] as Block[],
    },
  ];

  it('runs with inputs as locals and returns to the caller', () => {
    const rt = run(
      rpg(
        [
          {
            id: 'call',
            type: 'routine',
            routine: 'reward',
            args: { amount: 'gold / 4', who: '"Mira"' },
          },
          say('Gold {gold}.'),
          endBlock(),
        ],
        { routines },
      ),
    );
    playOn(rt);
    expect(lines(rt)).toEqual(['Mira pays 10.', 'Gold 30.']);
    expect(rt.value('amount')).toBeNull();
  });

  it('checks routine calls and input names', () => {
    const codes = checkStory(
      rpg(
        [
          { id: 'c1', type: 'routine', routine: 'reward', args: { nope: 1 } },
          { id: 'c2', type: 'routine', routine: 'ghost' },
          endBlock(),
        ],
        {
          routines: [
            ...routines,
            {
              id: 'clash',
              name: 'Clash',
              params: [{ id: 'gold', name: {}, type: 'number' }],
              blocks: [],
            },
          ],
        },
      ),
    ).map((p) => p.code);
    expect(codes).toEqual(
      expect.arrayContaining(['unknown-input', 'unknown-routine', 'input-clash']),
    );
  });
});
