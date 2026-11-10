import type { AudioDirector } from '@ie/audio';
import type { SequenceDef, StoryRuntime } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { compileSequence, sceneAt, steadyTime, type SequenceCue } from './compile.ts';
import { CueQueue, SequenceCursor } from './cursor.ts';
import { startBeat, wallClock } from './music.ts';
import { SequencePlayer, type FrameScheduler } from './player.ts';
import { SequenceRunner } from './runner.ts';

const sequence: SequenceDef = {
  id: 'scene',
  kind: 'scene',
  name: { en: 'Scene' },
  bpm: 120,
  length: 8,
  tracks: [
    {
      id: 's',
      kind: 'stage',
      clips: [
        { id: 'a', at: 0, action: 'stage.background.set', params: { preset: 'rain' } },
        { id: 'b', at: 2, action: 'stage.shake', params: { strength: 0.5 } },
        { id: 'c', at: 4, action: 'stage.background.set', params: { preset: 'snow' } },
        { id: 'd', at: 4, action: 'stage.look.set', params: { look: 'film' } },
      ],
    },
    {
      id: 't',
      kind: 'text',
      clips: [
        { id: 'e', at: 1, length: 4, action: 'stage.title', params: { text: { en: 'Go' } } },
        { id: 'f', at: 6, length: 400, action: 'stage.title', params: { text: { en: 'Long' } } },
      ],
    },
  ],
};

const names = (cues: readonly SequenceCue[]) => cues.map((c) => `${c.beat}:${c.action}`);

describe('compileSequence', () => {
  it('sorts cues by beat and gives titles seconds from their length', () => {
    const compiled = compileSequence(sequence);
    expect(names(compiled.cues)).toEqual([
      '0:stage.background.set',
      '1:stage.title',
      '2:stage.shake',
      '4:stage.background.set',
      '4:stage.look.set',
      '6:stage.title',
    ]);
    // 4 beats at 120 BPM are two seconds; a very long clip is held to the title's limit.
    expect(compiled.cues[1]?.params).toMatchObject({ seconds: 2 });
    expect(compiled.cues[5]?.params).toMatchObject({ seconds: 20 });
  });

  it('turns the length of a material clip into ramp seconds', () => {
    const compiled = compileSequence({
      ...sequence,
      tracks: [
        {
          id: 'm',
          kind: 'material',
          clips: [
            {
              id: 'r',
              at: 0,
              length: 2,
              action: 'stage.material.param',
              params: { material: 'glow', param: 'amount', value: 0, to: 1 },
            },
          ],
        },
      ],
    });
    expect(compiled.cues[0]?.params).toMatchObject({ seconds: 1, to: 1 });
  });

  it('follows the tempo it is given', () => {
    const compiled = compileSequence(sequence, steadyTime(60));
    expect(compiled.cues[1]?.params).toMatchObject({ seconds: 4 });
  });

  it('knows the scene in force at any beat', () => {
    const compiled = compileSequence(sequence);
    expect(sceneAt(compiled, 3).map((c) => c.params)).toEqual([{ preset: 'rain' }]);
    expect(sceneAt(compiled, 5).map((c) => c.params)).toEqual([
      { preset: 'snow' },
      { look: 'film' },
    ]);
  });
});

describe('SequenceCursor', () => {
  const cues = compileSequence(sequence).cues;

  it('fires each cue once as the clock passes it', () => {
    const cursor = new SequenceCursor(cues);
    const fired: SequenceCue[] = [];
    const fire = (cue: SequenceCue) => fired.push(cue);
    cursor.advance(-0.5, fire);
    expect(fired).toEqual([]);
    cursor.advance(0, fire);
    cursor.advance(0.01, fire);
    cursor.advance(2.5, fire);
    expect(names(fired)).toEqual(['0:stage.background.set', '1:stage.title', '2:stage.shake']);
    cursor.advance(10, fire);
    expect(fired).toHaveLength(6);
    expect(cursor.done).toBe(true);
  });

  it('seeks without firing, and treats a step back as a seek', () => {
    const cursor = new SequenceCursor(cues);
    const fired: SequenceCue[] = [];
    const fire = (cue: SequenceCue) => fired.push(cue);
    cursor.seek(4);
    cursor.advance(4, fire);
    expect(names(fired)).toEqual(['4:stage.background.set', '4:stage.look.set']);
    cursor.advance(1.5, fire);
    cursor.advance(2, fire);
    expect(names(fired).slice(2)).toEqual(['2:stage.shake']);
  });

  it('holds on a small step back (clock jitter) instead of firing cues again', () => {
    const cursor = new SequenceCursor(cues);
    const fired: SequenceCue[] = [];
    const fire = (cue: SequenceCue) => fired.push(cue);
    cursor.advance(2.01, fire);
    const count = fired.length;
    cursor.advance(1.99, fire);
    cursor.advance(2.02, fire);
    expect(fired).toHaveLength(count);
  });
});

describe('CueQueue', () => {
  it('fires cues added on the fly, shifted and in order', () => {
    const queue = new CueQueue();
    const fired: string[] = [];
    const fire = (cue: SequenceCue) => fired.push(`${cue.beat}:${cue.action}`);
    queue.add([{ beat: 1, action: 'stage.flash', params: {} }], 8);
    queue.add([{ beat: 0, action: 'stage.shake', params: {} }], 4);
    queue.advance(5, fire);
    expect(fired).toEqual(['4:stage.shake']);
    queue.add([{ beat: 0.5, action: 'stage.burst', params: {} }], 6);
    queue.advance(10, fire);
    expect(fired).toEqual(['4:stage.shake', '6.5:stage.burst', '9:stage.flash']);
    expect(queue.size).toBe(0);
  });
});

describe('clocks', () => {
  it('start a song on its next downbeat and a silent clock at once', () => {
    expect(startBeat(-1.3, 4, true)).toBe(0);
    expect(startBeat(5.2, 4, true)).toBe(8);
    expect(startBeat(3.98, 4, true)).toBe(8);
    expect(startBeat(0, 4, false)).toBe(0);
  });

  it('count wall-clock seconds from when they were made', () => {
    let ms = 1000;
    const clock = wallClock(() => ms);
    ms = 3500;
    expect(clock.position()).toBe(2.5);
    expect(clock.exact).toBe(true);
  });
});

describe('SequencePlayer', () => {
  it('dispatches cues from frames and ends after the last beat', () => {
    let beat: number | null = null;
    let queued: (() => void) | null = null;
    const frames: FrameScheduler = {
      request: (callback) => {
        queued = callback;
        return 1;
      },
      cancel: () => {
        queued = null;
      },
    };
    const ran: string[] = [];
    let ended = 0;
    const player = new SequencePlayer({
      sequence: compileSequence(sequence),
      now: () => beat,
      dispatch: (action) => ran.push(action),
      onEnd: () => ended++,
      frames,
    });
    player.start();
    const frame = () => queued?.();
    frame(); // the music hasn't started: nothing happens
    expect(ran).toEqual([]);
    beat = 2;
    frame();
    expect(ran).toEqual(['stage.background.set', 'stage.title', 'stage.shake']);
    beat = 9;
    frame();
    expect(ran).toHaveLength(6);
    expect(ended).toBe(1);
    expect(player.playing).toBe(false);
  });
});

describe('SequenceRunner', () => {
  function setup() {
    let queued: (() => void) | null = null;
    const frames: FrameScheduler = {
      request: (callback) => {
        queued = callback;
        return 1;
      },
      cancel: () => {
        queued = null;
      },
    };
    const audio = {
      music: { trackId: null, clock: { playing: false } },
      engine: { outputLatency: 0 },
    } as unknown as AudioDirector;
    const ran: string[] = [];
    let done = 0;
    const runner = new SequenceRunner({
      audio,
      dispatch: (action, params) => ran.push(`${action}:${JSON.stringify(params)}`),
      done: () => done++,
      frames,
    });
    const runtime = {
      log: [] as unknown[],
      waiting: { kind: 'sequence', blockId: 'b' } as unknown,
      story: {
        blocks: new Map([['b', { block: { type: 'sequence', sequence: 'scene' } }]]),
        project: { sequences: [sequence] },
      },
    };
    const story = runtime as unknown as StoryRuntime;
    return { runner, runtime, story, ran, frame: () => queued?.(), done: () => done };
  }

  it('stops a sequence the reader tapped past, shows where it ends, and never advances twice', async () => {
    const t = setup();
    t.runner.start(t.story, { kind: 'sequence', blockId: 'b' });
    await Promise.resolve();
    await Promise.resolve();
    t.frame(); // beat 0 on the silent clock: the first background
    expect(t.ran).toEqual(['stage.background.set:{"preset":"rain"}']);
    // A tap: the story moves on to the next line.
    t.runtime.waiting = { kind: 'line', blockId: 'l1' };
    t.runtime.log.push({});
    t.frame();
    expect(t.ran.slice(1)).toEqual([
      'stage.background.set:{"preset":"snow"}',
      'stage.look.set:{"look":"film"}',
    ]);
    expect(t.runner.running).toBe(false);
    t.frame();
    expect(t.done()).toBe(0);
  });
});
