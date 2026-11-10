import { describe, expect, it } from 'vitest';
import { analyzeProject } from './analyze.ts';
import { compileStory } from './compile.ts';
import { StoryRuntime } from './runtime.ts';
import type { Block, StoryProject } from './schema.ts';
import { storyStateSchema } from './state.ts';

const line = (id: string, en: string): Block => ({
  id,
  type: 'narration',
  text: { id, en, tr: en },
});

function project(blocks: Block[], extra: Partial<StoryProject> = {}): StoryProject {
  return {
    format: 'imagination.story',
    schemaVersion: 1,
    id: 'fights',
    title: { en: 'Fights' },
    languages: ['en'],
    start: 'p1',
    variables: [{ id: 'score', name: { en: 'Score' }, type: 'number' }],
    characters: [],
    enemies: [
      {
        id: 'stranger',
        name: { en: 'The Stranger' },
        moves: [{ id: 'm1', name: { en: 'Cut' }, pattern: 'jab', answer: 'parry' }],
      },
    ],
    chapters: [{ id: 'c1', title: { en: 'One' }, passages: [{ id: 'p1', blocks }] }],
    ...extra,
  };
}

const fight = (overrides: Partial<Extract<Block, { type: 'fight' }>> = {}): Block => ({
  id: 'f1',
  type: 'fight',
  enemy: 'stranger',
  score: 'score',
  win: [line('won', 'You win.'), { id: 'e1', type: 'end' }],
  lose: [line('lost', 'You fall.'), { id: 'e2', type: 'end' }],
  ...overrides,
});

describe('fight blocks', () => {
  it('pass the checks when the enemy exists', () => {
    expect(analyzeProject(project([fight()])).problems).toEqual([]);
  });

  it('report unknown enemies and tracks, and a score that is not a number', () => {
    const codes = analyzeProject(
      project([fight({ enemy: 'nobody', track: 'nosong', score: 'name' })], {
        variables: [{ id: 'name', name: { en: 'Name' }, type: 'text' }],
      }),
    ).problems.map((p) => p.code);
    expect(codes).toEqual(['unknown-enemy', 'unknown-track', 'variable-type']);
  });

  it('wait for the fight, then play the won branch and store the score', () => {
    const runtime = new StoryRuntime(compileStory(project([line('l0', 'Steel.'), fight()])));
    runtime.advance();
    const beats = runtime.advance();
    expect(beats.at(-1)).toEqual({ kind: 'fight', blockId: 'f1' });
    expect(() => runtime.advance()).toThrow(/fight/);

    runtime.resolveFight({ won: true, score: 87.6 });
    const after = runtime.advance();
    expect(after[0]).toEqual({ kind: 'fought', blockId: 'f1', won: true, score: 88 });
    expect(after.at(-1)).toMatchObject({ kind: 'line', blockId: 'won' });
    expect(runtime.value('score')).toBe(88);
    expect(storyStateSchema.safeParse(runtime.snapshot()).success).toBe(true);
  });

  it('play the lose branch when the fight is lost', () => {
    const runtime = new StoryRuntime(compileStory(project([fight()])));
    runtime.advance();
    runtime.resolveFight({ won: false, score: 20 });
    expect(runtime.advance().at(-1)).toMatchObject({ kind: 'line', blockId: 'lost' });
  });

  it('refuse a result when no fight is waiting', () => {
    const runtime = new StoryRuntime(compileStory(project([line('l0', 'Hi.'), fight()])));
    runtime.advance();
    expect(() => runtime.resolveFight({ won: true, score: 100 })).toThrow(/no fight/);
  });
});
