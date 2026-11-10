import { describe, expect, it } from 'vitest';
import { analyzeProject } from './analyze.ts';
import { compileStory } from './compile.ts';
import { StoryRuntime } from './runtime.ts';
import type { Block, StoryProject } from './schema.ts';
import { storyProjectSchema } from './project.ts';
import { sequenceClips, sequenceNotes, type SequenceDef } from './sequence.ts';
import { storyStateSchema } from './state.ts';

const line = (id: string, en: string): Block => ({ id, type: 'narration', text: { id, en } });

const scene: SequenceDef = {
  id: 'opening',
  kind: 'scene',
  name: { en: 'Opening' },
  bpm: 120,
  length: 8,
  tracks: [
    {
      id: 't1',
      kind: 'stage',
      clips: [
        { id: 'c2', at: 4, action: 'stage.look.set', params: { look: 'noir' } },
        { id: 'c1', at: 0, action: 'stage.background.set', params: { preset: 'rain' } },
        { id: 'c3', at: 2, action: 'stage.shake', params: { strength: 0.5 } },
      ],
    },
    {
      id: 't2',
      kind: 'text',
      clips: [
        { id: 'c4', at: 0, length: 2, action: 'stage.title', params: { text: { en: 'Hi' } } },
      ],
    },
    { id: 't3', kind: 'notes', muted: true, notes: [{ id: 'n1', at: 1, kind: 'strike' }] },
  ],
};

const move: SequenceDef = {
  id: 'cut',
  kind: 'move',
  name: { en: 'Cut' },
  length: 2,
  tracks: [
    {
      id: 'mn',
      kind: 'notes',
      notes: [
        { id: 'n2', at: 1, kind: 'dodge' },
        { id: 'n1', at: 0, kind: 'parry', power: 2 },
      ],
    },
  ],
};

function project(blocks: Block[], extra: Partial<StoryProject> = {}): StoryProject {
  return {
    format: 'imagination.story',
    schemaVersion: 1,
    id: 'seq',
    title: { en: 'Sequences' },
    languages: ['en'],
    start: 'p1',
    variables: [],
    characters: [],
    sequences: [scene, move],
    chapters: [{ id: 'c1', title: { en: 'One' }, passages: [{ id: 'p1', blocks }] }],
    ...extra,
  };
}

describe('sequences', () => {
  it('validate as project data', () => {
    expect(storyProjectSchema.safeParse(project([])).success).toBe(true);
    const bad = { ...scene, tracks: [{ id: 'x', kind: 'notes', notes: [{ id: 'n', at: -1 }] }] };
    expect(storyProjectSchema.safeParse(project([], { sequences: [bad as never] })).success).toBe(
      false,
    );
  });

  it('list clips and notes in beat order, leaving muted tracks out', () => {
    expect(sequenceClips(scene).map((c) => c.id)).toEqual(['c1', 'c4', 'c3', 'c2']);
    expect(sequenceNotes(scene)).toEqual([]);
    expect(sequenceNotes(move).map((n) => n.id)).toEqual(['n1', 'n2']);
  });

  it('wait on a Sequence block and leave its last background and look as the scene', () => {
    const runtime = new StoryRuntime(
      compileStory(
        project([{ id: 's1', type: 'sequence', sequence: 'opening' }, line('l1', 'After.')]),
      ),
    );
    const beats = runtime.advance();
    expect(beats.at(-1)).toEqual({ kind: 'sequence', blockId: 's1' });
    expect(runtime.scene).toMatchObject({
      'stage.background.set': { preset: 'rain' },
      'stage.look.set': { look: 'noir' },
    });
    expect(storyStateSchema.safeParse(runtime.snapshot()).success).toBe(true);
    expect(runtime.advance().at(-1)).toMatchObject({ kind: 'line', blockId: 'l1' });
  });

  it('fire sequence.play and go on when the block does not wait', () => {
    const ran: [string, unknown][] = [];
    const runtime = new StoryRuntime(
      compileStory(
        project([
          { id: 's1', type: 'sequence', sequence: 'opening', wait: false },
          line('l1', 'At once.'),
        ]),
      ),
      { host: { runAction: (id, params) => ran.push([id, params]) } },
    );
    expect(runtime.advance().at(-1)).toMatchObject({ kind: 'line', blockId: 'l1' });
    expect(ran).toEqual([['sequence.play', { sequence: 'opening' }]]);
  });

  it('pass the checks when everything they name exists', () => {
    const doc = project(
      [
        { id: 's1', type: 'sequence', sequence: 'opening' },
        { id: 'e', type: 'end' },
      ],
      {
        enemies: [
          {
            id: 'foe',
            name: { en: 'Foe' },
            moves: [
              { id: 'm1', name: { en: 'Cut' }, pattern: 'jab', answer: 'parry', sequence: 'cut' },
            ],
          },
        ],
      },
    );
    expect(analyzeProject(doc).problems).toEqual([]);
  });

  it('report missing sequences, wrong actions, empty moves and bad charts', () => {
    const broken: SequenceDef = {
      id: 'broken',
      kind: 'move',
      name: { en: 'Broken' },
      length: 2,
      tracks: [
        { id: 'a', kind: 'text', clips: [{ id: 'x1', at: 0, action: 'stage.shake', params: {} }] },
        { id: 'b', kind: 'stage', clips: [{ id: 'x2', at: 0, action: 'stage.shake', params: {} }] },
      ],
    };
    const codes = analyzeProject(
      project(
        [
          { id: 's1', type: 'sequence', sequence: 'nowhere' },
          { id: 'f1', type: 'fight', enemy: 'foe', chart: 'cut', win: [], lose: [] },
        ],
        {
          sequences: [scene, move, broken],
          enemies: [
            {
              id: 'foe',
              name: { en: 'Foe' },
              moves: [
                {
                  id: 'm1',
                  name: { en: 'A' },
                  pattern: 'jab',
                  answer: 'parry',
                  sequence: 'opening',
                },
              ],
            },
          ],
        },
      ),
    ).problems.map((p) => p.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'unknown-sequence',
        'unknown-chart',
        'clip-action',
        'action-params',
        'move-empty',
        'unknown-move-sequence',
      ]),
    );
  });
});
