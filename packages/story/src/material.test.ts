import { describe, expect, it } from 'vitest';
import { analyzeProject } from './analyze.ts';
import { compileStory } from './compile.ts';
import type { MaterialDef } from './material.ts';
import { StoryRuntime } from './runtime.ts';
import type { Block, StoryProject } from './schema.ts';

const action = (id: string, name: string, params: Record<string, unknown>): Block => ({
  id,
  type: 'action',
  action: name,
  params,
});

const material = (id: string, domain: MaterialDef['domain']): MaterialDef => ({
  id,
  name: { en: id, tr: id },
  domain,
  nodes: [
    { id: 'p', type: 'param', x: 0, y: 0, param: 'amount' },
    { id: 'o', type: 'output', x: 0, y: 0, inputs: { alpha: { node: 'p' } } },
  ],
  params: [{ id: 'amount', name: { en: 'Amount', tr: 'Miktar' }, default: 0.5, min: 0, max: 1 }],
});

function project(blocks: Block[], materials: MaterialDef[] = []): StoryProject {
  return {
    format: 'imagination.story',
    schemaVersion: 1,
    id: 'mat',
    title: { en: 'Materials' },
    languages: ['en', 'tr'],
    start: 'p1',
    variables: [],
    characters: [],
    chapters: [{ id: 'c1', title: { en: 'One' }, passages: [{ id: 'p1', blocks }] }],
    materials,
  };
}

const codes = (blocks: Block[], materials?: MaterialDef[]) =>
  analyzeProject(project(blocks, materials)).problems.map((p) => p.code);
const end: Block = { id: 'e', type: 'end' };
const mats = [material('wave', 'text'), material('glow', 'post')];

describe('material checks', () => {
  it('accepts titles, post materials and parameters that point at the right material', () => {
    expect(
      codes(
        [
          action('a1', 'stage.title', { text: { en: 'A', tr: 'A' }, material: 'wave' }),
          action('a2', 'stage.post.set', { material: 'glow' }),
          action('a3', 'stage.post.set', { material: '' }),
          action('a4', 'stage.material.param', { material: 'glow', param: 'amount', value: 1 }),
          end,
        ],
        mats,
      ),
    ).toEqual([]);
  });

  it('reports missing, unknown and wrong-domain materials and unknown parameters', () => {
    expect(
      codes(
        [
          action('a1', 'stage.title', { text: { en: 'A', tr: 'A' }, material: 'glow' }),
          action('a2', 'stage.post.set', { material: 'gone' }),
          action('a3', 'stage.material.param', { material: '', param: '', value: 1 }),
          action('a4', 'stage.material.param', { material: 'wave', param: 'nope', value: 1 }),
          end,
        ],
        mats,
      ),
    ).toEqual(['material-domain', 'unknown-material', 'material-missing', 'material-param']);
  });

  it('checks the materials themselves', () => {
    const broken: MaterialDef = {
      ...material('bad', 'post'),
      name: { en: 'Bad' },
      nodes: [{ id: 'p', type: 'param', x: 0, y: 0, param: 'gone' }],
    };
    expect(codes([end], [broken])).toEqual([
      'material-name',
      'material-output',
      'material-param',
    ]);
  });

  it('remembers the post material as scene state', () => {
    const story = compileStory(
      project([action('a1', 'stage.post.set', { material: 'glow' }), end], mats),
    );
    const runtime = new StoryRuntime(story);
    runtime.advance();
    expect(runtime.scene['stage.post.set']).toEqual({ material: 'glow' });
  });
});
