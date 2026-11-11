import { describe, expect, it } from 'vitest';
import { compileStory } from './compile.ts';
import { playtest, PlaytestTally } from './playtest.ts';
import type { Block, StoryProject } from './schema.ts';

let n = 0;
const t = (en: string) => ({ id: `pl${++n}`, en, tr: en });
const say = (text: string): Block => ({ id: `pb${++n}`, type: 'narration', text: t(text) });

function story(passages: { id: string; blocks: Block[] }[]): StoryProject {
  return {
    format: 'imagination.story',
    schemaVersion: 1,
    id: 'pt',
    title: { en: 'Playtest', tr: 'Playtest' },
    languages: ['en', 'tr'],
    start: 'start',
    variables: [{ id: 'gold', name: { en: 'Gold', tr: 'Altın' }, type: 'number', default: 5 }],
    characters: [],
    chapters: [{ id: 'c1', title: { en: 'One', tr: 'Bir' }, passages }],
  };
}

const sample = story([
  {
    id: 'start',
    blocks: [
      say('A door.'),
      {
        id: 'door',
        type: 'choice',
        options: [
          {
            id: 'open',
            text: t('Open it'),
            then: [
              { id: 'rich', type: 'set', var: 'gold', op: 'add', value: 10 },
              { id: 'win', type: 'end', ending: { id: 'good', title: t('Good') } },
            ],
          },
          { id: 'leave', text: t('Leave'), then: [{ id: 'j1', type: 'jump', to: 'empty' }] },
          { id: 'stuck', text: t('Wait'), then: [{ id: 'j2', type: 'jump', to: 'locked' }] },
          { id: 'never', text: t('Fly'), visibleIf: 'gold > 1000', then: [] },
        ],
      },
    ],
  },
  { id: 'empty', blocks: [say('Nothing here.')] },
  {
    id: 'locked',
    blocks: [
      {
        id: 'gate',
        type: 'choice',
        options: [{ id: 'pay', text: t('Pay'), enabledIf: 'gold > 1000', then: [] }],
      },
    ],
  },
  { id: 'orphan', blocks: [say('Nobody comes here.')] },
]);

describe('playtest', () => {
  const report = playtest(compileStory(sample, { allowErrors: true }), 120);

  it('counts endings, dead ends and softlocks', () => {
    expect(report.runs).toBe(120);
    expect(report.endings.good).toBeGreaterThan(20);
    expect(report.deadEnds[0]).toMatchObject({ passage: 'empty' });
    expect(report.softlocks[0]).toMatchObject({ passage: 'locked', blockId: 'gate' });
    const total =
      (report.endings.good ?? 0) +
      report.deadEnds.reduce((a, s) => a + s.count, 0) +
      report.softlocks.reduce((a, s) => a + s.count, 0);
    expect(total).toBe(120);
  });

  it('lists passages never seen and options never chosen', () => {
    expect(report.unseenPassages).toEqual(['orphan']);
    expect(report.unchosenOptions).toEqual(expect.arrayContaining(['never', 'pay']));
    expect(report.unchosenOptions).not.toContain('open');
  });

  it('tracks number ranges', () => {
    expect(report.ranges.gold).toEqual({ min: 5, max: 15 });
  });

  it('marks a run that never ends as stuck', () => {
    const loop = story([
      {
        id: 'start',
        blocks: [
          {
            id: 'again',
            type: 'choice',
            options: [
              { id: 'more', text: t('Again'), then: [{ id: 'j', type: 'jump', to: 'start' }] },
            ],
          },
        ],
      },
    ]);
    const r = playtest(compileStory(loop, { allowErrors: true }), 3, { maxSteps: 20 });
    expect(r.stuck[0]).toMatchObject({ passage: 'start', count: 3 });
  });

  it('builds the same report in slices', () => {
    const tally = new PlaytestTally(compileStory(sample, { allowErrors: true }));
    for (let seed = 1; seed <= 120; seed++) tally.play(seed);
    expect(tally.report()).toEqual(report);
  });
});
