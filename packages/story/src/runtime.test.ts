import { describe, expect, it } from 'vitest';
import { compileStory, StoryLoadError } from './compile.ts';
import { ENDINGS_KEY, StoryRuntime } from './runtime.ts';
import type { Block, StoryProject } from './schema.ts';
import { plainText } from './text.ts';

let n = 0;
const t = (en: string, tr = en) => ({ id: `ln${++n}`, en, tr });
const say = (text: string): Block => ({ id: `b${++n}`, type: 'narration', text: t(text) });

function project(
  passages: { id: string; blocks: Block[]; keepPage?: boolean }[],
  extra: Partial<StoryProject> = {},
): StoryProject {
  return {
    format: 'imagination.story',
    schemaVersion: 1,
    id: 'test',
    title: { en: 'Test', tr: 'Test' },
    languages: ['en', 'tr'],
    start: passages[0]?.id ?? 'start',
    variables: [
      { id: 'gold', name: { en: 'Gold', tr: 'Altın' }, type: 'number', default: 5, min: 0 },
      { id: 'charisma', name: { en: 'Charisma', tr: 'Karizma' }, type: 'number', default: 3 },
      { id: 'name', name: { en: 'Name', tr: 'İsim' }, type: 'text', default: 'Kerim' },
      { id: 'step', name: { en: 'Step', tr: 'Adım' }, type: 'number', scope: 'passage' },
      { id: 'scratch', name: { en: 'Scratch', tr: 'Taslak' }, type: 'number', scope: 'temp' },
      { id: 'runs', name: { en: 'Runs', tr: 'Oyunlar' }, type: 'number', scope: 'persistent' },
    ],
    characters: [{ id: 'mira', name: { en: 'Mira', tr: 'Mira' } }],
    chapters: [{ id: 'c1', title: { en: 'One', tr: 'Bir' }, passages }],
    ...extra,
  };
}

const lines = (rt: StoryRuntime) =>
  rt.page().flatMap((beat) => {
    if (beat.kind !== 'line') return [];
    const info = rt.story.blocks.get(beat.blockId);
    const block = info?.block;
    return block?.type === 'narration' || block?.type === 'dialogue'
      ? [plainText(rt.render(block.text, 'en', beat.values))]
      : [];
  });

describe('StoryRuntime', () => {
  it('shows lines one at a time and ends', () => {
    const rt = new StoryRuntime(
      compileStory(
        project([{ id: 'start', blocks: [say('One.'), say('Two.'), { id: 'e', type: 'end' }] }]),
      ),
      { seed: 1 },
    );
    expect(rt.advance().map((b) => b.kind)).toEqual(['passage', 'line']);
    expect(rt.advance().map((b) => b.kind)).toEqual(['line']);
    expect(lines(rt)).toEqual(['One.', 'Two.']);
    expect(rt.advance().map((b) => b.kind)).toEqual(['end']);
    expect(rt.ended).toBe(true);
  });

  it('offers every kind of option', () => {
    const story = compileStory(
      project([
        {
          id: 'start',
          blocks: [
            {
              id: 'pick',
              type: 'choice',
              timer: { seconds: 5, default: 'wait' },
              options: [
                { id: 'talk', text: t('Talk'), enabledIf: 'charisma >= 6', then: [] },
                { id: 'bribe', text: t('Bribe'), cost: { var: 'gold', amount: 10 }, then: [] },
                { id: 'secret', text: t('Secret'), visibleIf: 'gold > 100', then: [] },
                { id: 'look', text: t('Look'), once: true, then: [say('You look.')] },
                {
                  id: 'roll',
                  text: t('Sneak'),
                  showOdds: true,
                  then: [
                    {
                      id: 'chk',
                      type: 'check',
                      dice: '1d20',
                      modifier: 'charisma',
                      target: 13,
                      success: [],
                      fail: [],
                    },
                  ],
                },
                { id: 'wait', text: t('Wait'), then: [{ id: 'j', type: 'jump', to: 'start' }] },
              ],
            },
            { id: 'loop', type: 'jump', to: 'start' },
          ],
        },
      ]),
    );
    const rt = new StoryRuntime(story, { seed: 3 });
    const [, choice] = rt.advance();
    expect(choice?.kind).toBe('choice');
    if (choice?.kind !== 'choice') return;
    const byId = Object.fromEntries(choice.options.map((o) => [o.id, o]));
    expect(Object.keys(byId)).toEqual(['talk', 'bribe', 'look', 'roll', 'wait']);
    expect(byId.talk?.lock).toEqual({
      kind: 'requirement',
      requirement: { var: 'charisma', op: '>=', value: 6 },
    });
    expect(byId.bribe).toMatchObject({
      enabled: false,
      lock: { kind: 'cost' },
      cost: { var: 'gold', amount: 10 },
    });
    expect(byId.roll?.odds).toBeCloseTo(11 / 20);
    expect(choice.timer).toEqual({ seconds: 5, defaultOption: 'wait' });
    expect(() => rt.choose('talk')).toThrow("can't be chosen");

    rt.choose('look');
    expect(rt.advance().map((b) => b.kind)).toEqual(['chosen', 'line']);
    const next = rt.advance().at(-1);
    expect(next?.kind === 'choice' && next.options.map((o) => o.id)).toEqual([
      'talk',
      'bribe',
      'roll',
      'wait',
    ]);
  });

  it('pays costs, rolls checks deterministically and rejoins after a choice', () => {
    const blocks: Block[] = [
      {
        id: 'pick',
        type: 'choice',
        options: [
          { id: 'pay', text: t('Pay'), cost: { var: 'gold', amount: 2 }, then: [say('Paid.')] },
          {
            id: 'roll',
            text: t('Roll'),
            then: [
              {
                id: 'chk',
                type: 'check',
                dice: '2d6',
                target: 7,
                success: [say('Yes.')],
                fail: [say('No.')],
              },
            ],
          },
        ],
      },
      say('After.'),
      { id: 'e', type: 'end' },
    ];
    const rt = new StoryRuntime(compileStory(project([{ id: 'start', blocks }])), { seed: 42 });
    rt.advance();
    rt.choose('pay');
    rt.advance();
    expect(rt.value('gold')).toBe(3);
    expect(rt.advance().at(-1)?.kind).toBe('line');
    expect(lines(rt)).toEqual(['Paid.', 'After.']);

    const a = new StoryRuntime(compileStory(project([{ id: 'start', blocks }])), { seed: 7 });
    const b = new StoryRuntime(compileStory(project([{ id: 'start', blocks }])), { seed: 7 });
    for (const rt2 of [a, b]) {
      rt2.advance();
      rt2.choose('roll');
      rt2.advance();
    }
    expect(a.waiting).toEqual(b.waiting);
    expect(a.waiting?.kind).toBe('check');
  });

  it('asks for input and uses it with Turkish suffixes', () => {
    const story = compileStory(
      project([
        {
          id: 'start',
          blocks: [
            { id: 'ask', type: 'input', var: 'name', prompt: t('Name?', 'İsim?') },
            { id: 'greet', type: 'narration', text: t('Hello {name}.', "Selam {name}'e.") },
            { id: 'e', type: 'end' },
          ],
        },
      ]),
    );
    const rt = new StoryRuntime(story, { seed: 1 });
    expect(rt.advance().at(-1)?.kind).toBe('input');
    rt.submit('  Ayşe  ');
    const beat = rt.advance().at(-1);
    expect(beat?.kind).toBe('line');
    if (beat?.kind !== 'line') return;
    const block = story.blocks.get('greet')?.block;
    if (block?.type !== 'narration') return;
    expect(plainText(rt.render(block.text, 'tr', beat.values))).toBe("Selam Ayşe'ye.");
    expect(plainText(rt.render(block.text, 'en', beat.values))).toBe('Hello Ayşe.');
  });

  it('calls a passage and returns, and resets passage and temp scopes', () => {
    const story = compileStory(
      project([
        {
          id: 'start',
          blocks: [
            { id: 's1', type: 'set', var: 'step', value: 4 },
            { id: 'call', type: 'call', to: 'sub' },
            { id: 'after', type: 'narration', text: t('Back, step {step}.') },
            { id: 'e', type: 'end' },
          ],
        },
        { id: 'sub', blocks: [{ id: 'in', type: 'narration', text: t('In sub, step {step}.') }] },
      ]),
    );
    const rt = new StoryRuntime(story, { seed: 1 });
    rt.advance();
    expect(lines(rt)).toEqual(['In sub, step 0.']);
    rt.advance();
    // Returning from a call continues on the same page.
    expect(lines(rt)).toEqual(['In sub, step 0.', 'Back, step 0.']);
    expect(story.problems.filter((p) => p.code === 'dead-end')).toEqual([]);
  });

  it('keeps persistent values and endings outside the save', () => {
    const changes: unknown[] = [];
    const story = compileStory(
      project([
        {
          id: 'start',
          blocks: [
            { id: 'r', type: 'set', var: 'runs', op: 'add', value: 1 },
            { id: 'e', type: 'end', ending: { id: 'good', title: t('Good end') } },
          ],
        },
      ]),
    );
    const rt = new StoryRuntime(story, {
      persistent: { runs: 2 },
      host: { onPersistentChange: (v) => changes.push(v) },
    });
    expect(rt.advance().at(-1)).toMatchObject({ kind: 'end', endingId: 'good' });
    expect(rt.persistentValues).toEqual({ runs: 3, [ENDINGS_KEY]: ['good'] });
    expect(rt.snapshot().vars).toEqual({});
    expect(changes).toHaveLength(2);
  });

  it('rewinds through snapshots', () => {
    const story = compileStory(
      project([
        { id: 'start', blocks: [say('A.'), say('B.'), say('C.'), { id: 'e', type: 'end' }] },
      ]),
    );
    const rt = new StoryRuntime(story, { seed: 1 });
    const history = [];
    for (let i = 0; i < 3; i++) {
      history.push(rt.snapshot());
      rt.advance();
    }
    expect(lines(rt)).toEqual(['A.', 'B.', 'C.']);
    rt.restore(history[2] ?? rt.snapshot());
    expect(lines(rt)).toEqual(['A.', 'B.']);
  });

  it('resumes an old save after the story was edited', () => {
    const before = project([
      {
        id: 'start',
        blocks: [
          say('A.'),
          { id: 'mid', type: 'narration', text: t('B.') },
          say('C.'),
          { id: 'e', type: 'end' },
        ],
      },
    ]);
    const rt = new StoryRuntime(compileStory(before), { seed: 1 });
    rt.advance();
    rt.advance();
    const save = rt.snapshot();

    const passage = before.chapters[0]?.passages[0];
    const edited = project([
      { id: 'start', blocks: [say('New first.'), ...(passage?.blocks ?? [])] },
    ]);
    const resumed = new StoryRuntime(compileStory(edited), { state: save });
    resumed.advance();
    expect(lines(resumed).at(-1)).toBe('C.');

    const removed = project([{ id: 'start', blocks: [say('Only.'), { id: 'e2', type: 'end' }] }]);
    const restarted = new StoryRuntime(compileStory(removed), { state: save });
    restarted.advance();
    expect(lines(restarted)).toEqual(['Only.']);
  });

  it('refuses broken stories with plain-language problems', () => {
    const broken = project([
      {
        id: 'start',
        blocks: [
          { id: 'j', type: 'jump', to: 'nowhere' },
          { id: 'x', type: 'narration', text: t('{ghost} is here.') },
          { id: 'y', type: 'narration', text: t('[glow]hi[/glow]') },
          {
            id: 'c',
            type: 'choice',
            options: [{ id: 'o', text: t('Go'), enabledIf: 'gold >', then: [] }],
          },
        ],
      },
    ]);
    try {
      compileStory(broken);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(StoryLoadError);
      const codes = (error as StoryLoadError).problems.map((p) => p.code);
      expect(codes).toEqual(
        expect.arrayContaining(['unknown-passage', 'unknown-variable', 'markup', 'formula']),
      );
    }
  });

  it('warns about missing translations and dead ends', () => {
    const story = compileStory(
      project([
        {
          id: 'start',
          blocks: [{ id: 'a', type: 'narration', text: { id: 'only_en', en: 'Hi' } }],
        },
      ]),
    );
    expect(story.problems.map((p) => p.code)).toEqual(['missing-translation', 'dead-end']);
    const rt = new StoryRuntime(story, { seed: 1 });
    rt.advance();
    const block = story.blocks.get('a')?.block;
    if (block?.type === 'narration') expect(plainText(rt.render(block.text, 'tr'))).toBe('Hi');
    expect(rt.advance().at(-1)?.kind).toBe('end');
  });
});
