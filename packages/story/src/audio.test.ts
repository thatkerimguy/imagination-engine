import { describe, expect, it } from 'vitest';
import { analyzeProject } from './analyze.ts';
import { compileStory } from './compile.ts';
import { StoryRuntime } from './runtime.ts';
import type { Block, StoryProject } from './schema.ts';
import { sceneKey, storyStateSchema } from './state.ts';

const line = (id: string, en: string): Block => ({
  id,
  type: 'narration',
  text: { id: `l_${id}`, en, tr: en },
});
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
    id: 'audio',
    title: { en: 'Audio' },
    languages: ['en', 'tr'],
    start: 'p1',
    variables: [],
    characters: [],
    chapters: [{ id: 'c1', title: { en: 'One' }, passages: [{ id: 'p1', blocks }] }],
    audio: {
      tracks: [
        { id: 'theme', title: 'Theme', source: { kind: 'url', url: 'https://a.test/t.mp3' } },
      ],
      sounds: [],
    },
  };
}

describe('scene state', () => {
  it('keys set actions by slot', () => {
    expect(sceneKey('audio.music.set', { track: 'a' })).toBe('audio.music.set');
    expect(sceneKey('audio.ambience.set', { slot: 'rain', volume: 1 })).toBe(
      'audio.ambience.set:rain',
    );
  });

  it('remembers the last set per key and survives a save', () => {
    const calls: string[] = [];
    const story = compileStory(
      project([
        action('a1', 'audio.music.set', { track: 'theme' }),
        action('a2', 'audio.ambience.set', { slot: 'rain', volume: 0.5 }),
        line('b1', 'First.'),
        action('a3', 'audio.music.set', { track: null, fade: 2 }),
        line('b2', 'Second.'),
        { id: 'e', type: 'end' },
      ]),
    );
    const rt = new StoryRuntime(story, { host: { runAction: (id) => calls.push(id) } });
    rt.advance();
    expect(rt.scene).toEqual({
      'audio.music.set': { track: 'theme' },
      'audio.ambience.set:rain': { slot: 'rain', volume: 0.5 },
    });
    const saved = storyStateSchema.parse(JSON.parse(JSON.stringify(rt.snapshot())));
    rt.advance();
    expect(rt.scene['audio.music.set']).toEqual({ track: null, fade: 2 });

    rt.restore(saved);
    expect(rt.scene['audio.music.set']).toEqual({ track: 'theme' });
    expect(calls).toEqual(['audio.music.set', 'audio.ambience.set', 'audio.music.set']);
  });

  it('reads saves from before scene state existed', () => {
    const rt = new StoryRuntime(compileStory(project([line('b1', 'Hi.')])));
    const old = { ...rt.snapshot() };
    delete (old as { scene?: unknown }).scene;
    expect(storyStateSchema.safeParse(old).success).toBe(true);
  });
});

describe('audio checks', () => {
  const codes = (blocks: Block[]) => analyzeProject(project(blocks)).problems.map((p) => p.code);

  it('accepts complete audio blocks', () => {
    expect(
      codes([action('a1', 'audio.music.set', { track: 'theme' }), { id: 'e', type: 'end' }]),
    ).toEqual([]);
  });

  it('reports unknown tracks and sounds, and unfinished params', () => {
    expect(
      codes([
        action('a1', 'audio.music.set', { track: 'gone' }),
        action('a2', 'audio.sfx.play', { sound: 'boom' }),
        action('a3', 'audio.ambience.set', { slot: 'rain' }),
        { id: 'e', type: 'end' },
      ]),
    ).toEqual(['unknown-track', 'unknown-sound', 'action-params']);
  });

  it('leaves actions of other modules alone', () => {
    expect(codes([action('a1', 'combat.strike', { power: 3 }), { id: 'e', type: 'end' }])).toEqual(
      [],
    );
  });
});
