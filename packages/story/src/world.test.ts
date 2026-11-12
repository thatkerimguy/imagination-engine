import { describe, expect, it } from 'vitest';
import { checkStory, compileStory } from './compile.ts';
import { playtest } from './playtest.ts';
import { StoryRuntime } from './runtime.ts';
import type { Block, StoryProject } from './schema.ts';
import { directionBetween, spaceOrder, type RoomDef, type SpaceDef } from './world.ts';

let n = 0;
const t = (en: string) => ({ id: `wl${++n}`, en, tr: en });
const say = (text: string): Block => ({ id: `wb${++n}`, type: 'narration', text: t(text) });
const exits = (): Block => ({ id: `wx${++n}`, type: 'exits' });

/** Hall in the middle, a garden to the east, a cellar below behind a locked door. */
function house(extra: Partial<StoryProject> = {}, world: Partial<StoryProject['world']> = {}) {
  const room = (id: string, x: number, y: number, exitList: RoomDef['exits']): RoomDef => ({
    id,
    name: { en: id, tr: id },
    passage: `p_${id}`,
    x,
    y,
    exits: exitList,
  });
  const project: StoryProject = {
    format: 'imagination.story',
    schemaVersion: 1,
    id: 'house',
    title: { en: 'House', tr: 'Ev' },
    languages: ['en', 'tr'],
    start: 'p_hall',
    variables: [{ id: 'key', name: { en: 'Key', tr: 'Anahtar' }, type: 'bool', default: false }],
    characters: [],
    chapters: [
      {
        id: 'c1',
        title: { en: 'One', tr: 'Bir' },
        passages: ['hall', 'garden', 'cellar', 'attic'].map((id) => ({
          id: `p_${id}`,
          blocks: [say(`In the ${id}.`), exits()],
        })),
      },
    ],
    world: {
      rooms: [
        room('hall', 0, 0, [
          { id: 'x1', dir: 'e', to: 'garden' },
          {
            id: 'x2',
            dir: 'down',
            to: 'cellar',
            enabledIf: 'key',
            lockedText: t('Locked.'),
          },
        ]),
        room('garden', 1, 0, [
          { id: 'x3', dir: 'w', to: 'hall' },
          { id: 'x4', dir: 'n', to: 'attic', visibleIf: 'key' },
        ]),
        room('cellar', 0, 1, [{ id: 'x5', dir: 'up', to: 'hall' }]),
        { ...room('attic', 1, -1, [{ id: 'x6', dir: 's', to: 'garden' }]), secret: true },
      ],
      ...world,
    },
    ...extra,
  };
  return project;
}

function walk(rt: StoryRuntime, to: string) {
  rt.advance();
  rt.go(to);
}

describe('rooms and exits', () => {
  it('puts the reader in the room whose passage plays and offers its exits', () => {
    const rt = new StoryRuntime(compileStory(house()), { seed: 1 });
    rt.advance();
    expect(rt.room).toBe('hall');
    rt.advance();
    const beat = rt.waiting;
    expect(beat?.kind).toBe('exits');
    if (beat?.kind !== 'exits') return;
    expect(beat.exits.map((e) => [e.to, e.enabled])).toEqual([
      ['garden', true],
      ['cellar', false],
    ]);
    expect(beat.exits[1]?.lock).toEqual({ kind: 'text' });
  });

  it('walks through an open exit, logs it, and refuses a locked one', () => {
    const rt = new StoryRuntime(compileStory(house()), { seed: 1 });
    rt.advance();
    rt.advance();
    expect(() => rt.go('cellar')).toThrow();
    rt.go('garden');
    const beats = rt.advance();
    expect(beats[0]).toMatchObject({ kind: 'went', room: 'garden', exit: 'x1', from: 'hall' });
    expect(beats[1]).toMatchObject({ kind: 'passage', passageId: 'p_garden' });
    expect(rt.room).toBe('garden');
  });

  it('hides exits until their condition holds', () => {
    const rt = new StoryRuntime(compileStory(house()), { seed: 1 });
    rt.advance();
    walk(rt, 'garden');
    rt.advance(); // the garden's first line
    rt.advance();
    const beat = rt.waiting;
    expect(beat?.kind === 'exits' && beat.exits.map((e) => e.to)).toEqual(['hall']);
  });

  it('can be driven only while an Exits block waits', () => {
    const rt = new StoryRuntime(compileStory(house()), { seed: 1 });
    rt.advance();
    expect(() => rt.go('garden')).toThrow('no exits waiting');
  });

  it('keeps the room through a save and forgets deleted rooms', () => {
    const rt = new StoryRuntime(compileStory(house()), { seed: 1 });
    rt.advance();
    walk(rt, 'garden');
    const state = rt.snapshot();
    expect(state.rooms).toEqual(['hall', 'garden']);
    const smaller = house();
    const world = smaller.world;
    if (!world) return;
    const trimmed = {
      ...smaller,
      world: {
        ...world,
        rooms: world.rooms
          .filter((r) => r.id !== 'garden')
          .map((r) => ({ ...r, exits: r.exits.filter((e) => e.to !== 'garden') })),
      },
    };
    const copy = new StoryRuntime(compileStory(trimmed, { allowErrors: true }), { state });
    expect(copy.room).toBeNull();
    expect(copy.snapshot().rooms).toEqual(['hall']);
  });
});

describe('the map', () => {
  it('shows visited rooms, their neighbours as unknown, and never a secret room', () => {
    const rt = new StoryRuntime(compileStory(house()), { seed: 1 });
    rt.advance();
    rt.advance();
    const map = rt.map();
    expect(map.here).toBe('hall');
    expect(map.rooms.map((r) => [r.id, r.state, r.reachable])).toEqual([
      ['hall', 'here', false],
      ['garden', 'unknown', true],
      ['cellar', 'unknown', false],
    ]);
    expect(map.links.map((l) => `${l.from}-${l.to}`)).toEqual(['hall-garden', 'hall-cellar']);
  });

  it('shows only visited rooms, or every room that is not secret', () => {
    const visited = new StoryRuntime(compileStory(house({}, { reveal: 'visited' })), { seed: 1 });
    visited.advance();
    expect(visited.map().rooms.map((r) => r.id)).toEqual(['hall']);
    const all = new StoryRuntime(compileStory(house({}, { reveal: 'all' })), { seed: 1 });
    all.advance();
    expect(all.map().rooms.map((r) => r.id)).toEqual(['hall', 'garden', 'cellar']);
  });

  it('fast travel reaches any room already visited', () => {
    const open = house(
      {
        variables: [{ id: 'key', name: { en: 'Key', tr: 'Anahtar' }, type: 'bool', default: true }],
      },
      { fastTravel: true },
    );
    const rt = new StoryRuntime(compileStory(open), { seed: 1 });
    rt.advance();
    walk(rt, 'cellar');
    rt.advance();
    walk(rt, 'hall');
    rt.advance();
    walk(rt, 'garden');
    rt.advance();
    rt.advance();
    // The cellar is two rooms away, so only the map can take the reader there.
    expect(rt.map().rooms.find((r) => r.id === 'cellar')?.reachable).toBe(true);
    rt.go('cellar');
    const beats = rt.advance();
    expect(beats[0]).toMatchObject({ kind: 'went', room: 'cellar' });
    expect(beats[0]).not.toHaveProperty('exit');
  });
});

describe('world analysis', () => {
  const codes = (project: StoryProject) => checkStory(project).map((p) => p.code);

  it('accepts a sound world and counts exit targets as reachable', () => {
    expect(codes(house())).toEqual([]);
  });

  it('reports broken rooms, exits, Exits blocks outside rooms and spaces', () => {
    const project = house({
      spaces: [
        { id: 'sp1', name: { en: 'Notes', tr: 'Notlar' }, side: 'right', kind: 'screen' },
        { id: 'sp2', name: { en: 'Map', tr: 'Harita' }, side: 'left', kind: 'map' },
      ],
    });
    const world = project.world;
    if (!world) return;
    const broken: StoryProject = {
      ...project,
      chapters: [
        {
          ...project.chapters[0]!,
          passages: [...project.chapters[0]!.passages, { id: 'p_lost', blocks: [exits()] }],
        },
      ],
      start: 'p_hall',
      world: {
        ...world,
        rooms: [
          ...world.rooms.map((r) =>
            r.id === 'cellar'
              ? { ...r, x: 0, y: 0, exits: [{ id: 'x9', dir: 'up' as const, to: 'nowhere' }] }
              : r,
          ),
          {
            id: 'twin',
            name: { en: 'Twin', tr: 'İkiz' },
            passage: 'p_hall',
            x: 5,
            y: 5,
            exits: [],
          },
        ],
      },
    };
    const found = codes(broken);
    for (const code of [
      'unknown-room',
      'room-overlap',
      'room-passage-twice',
      'exits-outside',
      'unknown-screen',
    ])
      expect(found, code).toContain(code);
  });
});

describe('playtesting a world', () => {
  it('walks between rooms without getting stuck on Exits blocks', () => {
    const project = house({}, { fastTravel: true });
    const report = playtest(compileStory(project), 5, { maxSteps: 60 });
    expect(report.errors).toEqual([]);
    expect(report.softlocks).toEqual([]);
    expect(report.unseenPassages).toEqual(['p_cellar', 'p_attic']);
  });
});

describe('world helpers', () => {
  it('names the direction between neighbouring squares', () => {
    expect(directionBetween({ x: 0, y: 0 }, { x: 1, y: -1 })).toBe('ne');
    expect(directionBetween({ x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
  });

  it('orders spaces outwards from the story', () => {
    const space = (id: string, side: SpaceDef['side']): SpaceDef => ({
      id,
      name: {},
      side,
      kind: 'map',
    });
    const order = spaceOrder([space('a', 'left'), space('b', 'right'), space('c', 'left')]);
    expect(order.map((s) => (s === 'story' ? s : s.id))).toEqual(['c', 'a', 'story', 'b']);
  });
});
