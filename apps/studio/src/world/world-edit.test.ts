import { analyzeProject, storyProjectSchema, type StoryProject } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { newProject } from '../project/factory.ts';
import {
  addExit,
  addRoom,
  addSpace,
  appendExitsBlock,
  deleteRoom,
  endsWithExits,
  moveSpace,
  removeExit,
  removeSpace,
  suggestDirection,
  updateExit,
  worldOf,
} from './world-edit.ts';

const name = (n: string) => ({ en: n, tr: n });

function twoRooms(): { doc: StoryProject; hall: string; garden: string } {
  const first = addRoom(newProject(name('House')), { x: 0, y: 0 }, name('Hall'), 'Hall');
  const second = addRoom(first.doc, { x: 1, y: 0 }, name('Garden'), 'Garden', first.roomId);
  return { doc: second.doc, hall: first.roomId, garden: second.roomId };
}

describe('world edits', () => {
  it('adds a room with its own passage ending in an Exits block', () => {
    const { doc, roomId } = addRoom(
      newProject(name('House')),
      { x: 0, y: 0 },
      name('Hall'),
      'Hall',
    );
    const room = worldOf(doc).rooms[0];
    expect(room?.id).toBe(roomId);
    const passage = doc.chapters[0]?.passages.find((p) => p.id === room?.passage);
    expect(passage?.name).toBe('Hall');
    expect(endsWithExits(doc, room?.passage ?? '')).toBe(true);
    expect(storyProjectSchema.safeParse(doc).success).toBe(true);
  });

  it('joins a room added next to another both ways', () => {
    const { doc, hall, garden } = twoRooms();
    const rooms = worldOf(doc).rooms;
    expect(rooms.find((r) => r.id === hall)?.exits).toMatchObject([{ dir: 'e', to: garden }]);
    expect(rooms.find((r) => r.id === garden)?.exits).toMatchObject([{ dir: 'w', to: hall }]);
    const codes = analyzeProject(doc).problems.map((p) => p.code);
    expect(codes).not.toContain('exit-target');
    expect(codes).not.toContain('room-overlap');
  });

  it('does not add a second way back when one exists', () => {
    const { doc, hall, garden } = twoRooms();
    const next = addExit(doc, hall, 'in', garden, true);
    expect(worldOf(next).rooms.find((r) => r.id === garden)?.exits).toHaveLength(1);
    expect(worldOf(next).rooms.find((r) => r.id === hall)?.exits).toHaveLength(2);
  });

  it('removes exits into a deleted room but keeps its passage', () => {
    const { doc, hall, garden } = twoRooms();
    const passages = doc.chapters[0]?.passages.length;
    const next = deleteRoom(doc, garden);
    expect(worldOf(next).rooms.map((r) => r.id)).toEqual([hall]);
    expect(worldOf(next).rooms[0]?.exits).toEqual([]);
    expect(next.chapters[0]?.passages.length).toBe(passages);
  });

  it('edits and removes one exit', () => {
    const { doc, hall } = twoRooms();
    const exit = worldOf(doc).rooms.find((r) => r.id === hall)?.exits[0];
    const edited = updateExit(doc, hall, exit?.id ?? '', (e) => ({ ...e, dir: 'in' }));
    expect(worldOf(edited).rooms.find((r) => r.id === hall)?.exits[0]?.dir).toBe('in');
    const removed = removeExit(edited, hall, exit?.id ?? '');
    expect(worldOf(removed).rooms.find((r) => r.id === hall)?.exits).toEqual([]);
  });

  it('suggests the compass direction, else a free one', () => {
    const { doc, hall, garden } = twoRooms();
    const rooms = worldOf(doc).rooms;
    const h = rooms.find((r) => r.id === hall);
    const g = rooms.find((r) => r.id === garden);
    if (!h || !g) throw new Error('rooms missing');
    expect(suggestDirection(g, h)).toBe('w');
    expect(suggestDirection(h, { ...g, x: 5 })).toBe('n');
    expect(suggestDirection({ ...h, exits: [{ id: 'x1', dir: 'n', to: g.id }] }, undefined)).toBe(
      'e',
    );
  });

  it('appends an Exits block to a passage', () => {
    const doc = newProject(name('House'));
    const start = doc.start;
    expect(endsWithExits(doc, start)).toBe(false);
    expect(endsWithExits(appendExitsBlock(doc, start), start)).toBe(true);
  });
});

describe('space edits', () => {
  it('adds, orders and removes spaces', () => {
    let doc = addSpace(newProject(name('House')), 'map', name('Map'));
    doc = addSpace(doc, 'screen', name('Notes'), 'scr1');
    expect(doc.spaces).toMatchObject([
      { kind: 'map', side: 'left' },
      { kind: 'screen', side: 'right', screen: 'scr1' },
    ]);
    const second = doc.spaces?.[1]?.id ?? '';
    doc = moveSpace(doc, second, -1);
    expect(doc.spaces?.[0]?.id).toBe(second);
    expect(moveSpace(doc, second, -1)).toBe(doc);
    doc = removeSpace(doc, second);
    expect(doc.spaces).toHaveLength(1);
    doc = removeSpace(doc, doc.spaces?.[0]?.id ?? '');
    expect('spaces' in doc).toBe(false);
  });

  it('stops at the most spaces a novel can have', () => {
    let doc = newProject(name('House'));
    for (let i = 0; i < 8; i++) doc = addSpace(doc, 'map', name(`Map ${i}`));
    expect(doc.spaces).toHaveLength(6);
  });
});
