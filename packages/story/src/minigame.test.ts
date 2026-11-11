import { describe, expect, it } from 'vitest';
import { analyzeProject } from './analyze.ts';
import { compileStory } from './compile.ts';
import {
  defaultGame,
  MINIGAME_DEFAULTS,
  MINIGAME_TEMPLATES,
  minigameGameSchema,
  minigameValues,
  minigameResultSchema,
} from './minigame.ts';
import { StoryRuntime } from './runtime.ts';
import { blockSchema, type Block, type StoryProject } from './schema.ts';
import { storyStateSchema } from './state.ts';

type Minigame = Extract<Block, { type: 'minigame' }>;

const line = (id: string, en: string): Block => ({
  id,
  type: 'narration',
  text: { id, en, tr: en },
});

function project(blocks: Block[], extra: Partial<StoryProject> = {}): StoryProject {
  return {
    format: 'imagination.story',
    schemaVersion: 1,
    id: 'games',
    title: { en: 'Games' },
    languages: ['en'],
    start: 'p1',
    variables: [
      { id: 'score', name: { en: 'Score' }, type: 'number' },
      { id: 'total', name: { en: 'Total' }, type: 'number' },
      { id: 'name', name: { en: 'Name' }, type: 'text' },
    ],
    characters: [],
    chapters: [{ id: 'c1', title: { en: 'One' }, passages: [{ id: 'p1', blocks }] }],
    ...extra,
  };
}

const game = (overrides: Partial<Minigame> = {}): Block => ({
  id: 'g1',
  type: 'minigame',
  game: { template: 'dice' },
  score: 'score',
  store: { total: 'total' },
  win: [line('won', 'It opens.'), { id: 'e1', type: 'end' }],
  lose: [line('lost', 'It holds.'), { id: 'e2', type: 'end' }],
  ...overrides,
});

describe('minigame data', () => {
  it('has defaults, result values and a playable starter for every template', () => {
    for (const template of MINIGAME_TEMPLATES) {
      expect(minigameValues(defaultGame(template)).length).toBeGreaterThan(0);
      expect(minigameGameSchema.safeParse(defaultGame(template)).success).toBe(true);
      expect(
        minigameGameSchema.safeParse({ ...defaultGame(template), ...MINIGAME_DEFAULTS[template] })
          .success,
      ).toBe(true);
    }
  });

  it('refuses parameters outside their limits and unknown templates', () => {
    expect(minigameGameSchema.safeParse({ template: 'lockpick', pins: 0 }).success).toBe(false);
    expect(minigameGameSchema.safeParse({ template: 'dice', sides: 7 }).success).toBe(false);
    expect(minigameGameSchema.safeParse({ template: 'cipher', words: [] }).success).toBe(false);
    expect(minigameGameSchema.safeParse({ template: 'chess' }).success).toBe(false);
    expect(minigameResultSchema.safeParse({ won: true, score: 101 }).success).toBe(false);
    expect(blockSchema.safeParse(game()).success).toBe(true);
  });
});

describe('minigame blocks', () => {
  it('pass the checks when their variables are numbers', () => {
    expect(analyzeProject(project([game()])).problems).toEqual([]);
  });

  it('report a wrong score variable, an unknown result and a variable that is missing', () => {
    const problems = analyzeProject(
      project([game({ score: 'name', store: { rounds: 'total', total: 'nowhere' } })]),
    ).problems;
    expect(problems.map((p) => p.code)).toEqual([
      'variable-type',
      'minigame-value',
      'unknown-variable',
    ]);
    expect(problems.every((p) => p.where === 'g1')).toBe(true);
  });

  it('warn about missing words, short ciphers and dice that cannot or always win', () => {
    const codes = (block: Block) =>
      analyzeProject(project([block], { languages: ['en', 'tr'] })).problems.map((p) => p.code);
    const cipher = (words: { en?: string; tr?: string }[]) =>
      game({ game: { template: 'cipher', words }, store: {} });
    expect(codes(cipher([{ en: 'SECRET' }]))).toEqual(['minigame-text']);
    expect(codes(cipher([{ en: 'NO', tr: 'YO' }]))).toEqual(['minigame-short', 'minigame-short']);
    expect(codes(cipher([{ en: 'SECRET', tr: 'GİZEM' }]))).toEqual([]);
    expect(codes(game({ game: { template: 'dice', target: 13 } }))).toEqual(['minigame-odds']);
    expect(codes(game({ game: { template: 'dice', target: 2 } }))).toEqual(['minigame-odds']);
    expect(codes(game({ game: { template: 'tension', hold: 10, limit: 8 }, store: {} }))).toEqual([
      'minigame-odds',
    ]);
  });

  it('wait for the game, then store the score and values and play the won branch', () => {
    const runtime = new StoryRuntime(compileStory(project([line('l0', 'A lock.'), game()])));
    runtime.advance();
    const beats = runtime.advance();
    expect(beats.at(-1)).toEqual({ kind: 'minigame', blockId: 'g1' });
    expect(() => runtime.advance()).toThrow(/minigame/);

    runtime.resolveMinigame({ won: true, score: 71.5, values: { total: 9, bogus: 4 } });
    const after = runtime.advance();
    expect(after[0]).toEqual({ kind: 'played', blockId: 'g1', won: true, score: 72 });
    expect(after.at(-1)).toMatchObject({ kind: 'line', blockId: 'won' });
    expect(runtime.value('score')).toBe(72);
    expect(runtime.value('total')).toBe(9);
    expect(storyStateSchema.safeParse(runtime.snapshot()).success).toBe(true);
  });

  it('play the lost branch, and a rewind waits on the game again', () => {
    const runtime = new StoryRuntime(compileStory(project([game()])));
    runtime.advance();
    const before = runtime.snapshot();
    runtime.resolveMinigame({ won: false, score: 20 });
    expect(runtime.advance().at(-1)).toMatchObject({ kind: 'line', blockId: 'lost' });
    expect(runtime.value('total')).toBe(0);

    runtime.restore(before);
    expect(runtime.waiting).toEqual({ kind: 'minigame', blockId: 'g1' });
    expect(() => runtime.resolveFight({ won: true, score: 1 })).toThrow(/no fight/);
  });

  it('refuse a result when no minigame waits', () => {
    const runtime = new StoryRuntime(compileStory(project([line('l0', 'Quiet.')])));
    runtime.advance();
    expect(() => runtime.resolveMinigame({ won: true, score: 1 })).toThrow(/no minigame/);
  });
});
