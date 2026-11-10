import { describe, expect, it } from 'vitest';
import { analyzeProject } from './analyze.ts';
import { compileStory } from './compile.ts';
import { StoryRuntime } from './runtime.ts';
import type { Block, StoryProject } from './schema.ts';

const action = (id: string, name: string, params: Record<string, unknown>): Block => ({
  id,
  type: 'action',
  action: name,
  params,
});

function project(blocks: Block[]): StoryProject {
  return {
    format: 'imagination.story',
    schemaVersion: 1,
    id: 'stage',
    title: { en: 'Stage' },
    languages: ['en', 'tr'],
    start: 'p1',
    variables: [],
    characters: [],
    chapters: [{ id: 'c1', title: { en: 'One' }, passages: [{ id: 'p1', blocks }] }],
  };
}

const codes = (blocks: Block[]) =>
  analyzeProject(project(blocks)).problems.map((p) => p.code);

describe('stage checks', () => {
  it('accepts complete stage blocks', () => {
    expect(
      codes([
        action('a1', 'stage.background.set', { preset: 'rain' }),
        action('a2', 'stage.shake', { strength: 0.5 }),
        action('a3', 'stage.title', { text: { en: 'Night', tr: 'Gece' } }),
        { id: 'e', type: 'end' },
      ]),
    ).toEqual([]);
  });

  it('reports bad params, empty titles and missing translations', () => {
    expect(
      codes([
        action('a1', 'stage.shake', { strength: 3 }),
        action('a2', 'stage.title', { text: {} }),
        action('a3', 'stage.title', { text: { en: 'Night' } }),
        { id: 'e', type: 'end' },
      ]),
    ).toEqual(['action-params', 'title-empty', 'title-translation']);
  });

  it('remembers the background and look as scene state, not moments', () => {
    const story = compileStory(
      project([
        action('a1', 'stage.background.set', { preset: 'embers' }),
        action('a2', 'stage.look.set', { look: 'film' }),
        action('a3', 'stage.flash', {}),
        { id: 'l', type: 'narration', text: { id: 'l', en: 'Hi', tr: 'Selam' } },
        { id: 'e', type: 'end' },
      ]),
    );
    const runtime = new StoryRuntime(story, { host: { runAction: () => undefined } });
    runtime.advance();
    expect(Object.keys(runtime.scene).sort()).toEqual(['stage.background.set', 'stage.look.set']);
  });
});
