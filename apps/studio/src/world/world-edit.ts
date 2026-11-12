import { createId } from '@ie/core';
import {
  directionBetween,
  MAX_EXITS,
  MAX_ROOMS,
  MAX_SPACES,
  OPPOSITE,
  type Block,
  type Direction,
  type ExitDef,
  type Label,
  type Passage,
  type RoomDef,
  type SpaceDef,
  type SpaceKind,
  type StoryProject,
  type WorldDef,
} from '@ie/story';
import { newPassage } from '../project/factory.ts';

/*
 * Pure edits of the world and the spaces (ADR 0031). Each returns a new project, so the store's
 * undo history covers them like every other edit.
 */

export function worldOf(doc: StoryProject): WorldDef {
  return doc.world ?? { rooms: [] };
}

export function setWorld(doc: StoryProject, change: (w: WorldDef) => WorldDef): StoryProject {
  return { ...doc, world: change(worldOf(doc)) };
}

export function roomAt(doc: StoryProject, x: number, y: number): RoomDef | undefined {
  return worldOf(doc).rooms.find((r) => r.x === x && r.y === y);
}

/** A passage ending with an Exits block, so a new room can be walked out of at once. */
function roomPassage(name: string): Passage {
  const passage = newPassage(name);
  const exits: Block = { id: createId('b'), type: 'exits' };
  return { ...passage, blocks: [...passage.blocks, exits] };
}

/** Whether a room can take another way out (the schema allows MAX_EXITS). */
export function exitsFull(room: RoomDef | undefined): boolean {
  return (room?.exits.length ?? 0) >= MAX_EXITS;
}

export function worldFull(doc: StoryProject): boolean {
  return worldOf(doc).rooms.length >= MAX_ROOMS;
}

/**
 * A new room on a square, with its own passage in the first chapter. Given a neighbour, the two
 * are joined both ways through the compass direction between them (only from the new room when
 * the neighbour has no exit to spare). A full world gets no room: `roomId` is then empty.
 */
export function addRoom(
  doc: StoryProject,
  at: { readonly x: number; readonly y: number },
  name: Label,
  passageName: string,
  joinTo?: string,
): { doc: StoryProject; roomId: string } {
  if (worldFull(doc)) return { doc, roomId: '' };
  const passage = roomPassage(passageName);
  const room: RoomDef = { id: createId('rm'), name, passage: passage.id, ...at, exits: [] };
  let next: StoryProject = {
    ...doc,
    chapters: doc.chapters.map((c, i) =>
      i === 0 ? { ...c, passages: [...c.passages, passage] } : c,
    ),
  };
  next = setWorld(next, (w) => ({ ...w, rooms: [...w.rooms, room] }));
  const neighbour = joinTo ? worldOf(next).rooms.find((r) => r.id === joinTo) : undefined;
  const dir = neighbour ? directionBetween(neighbour, room) : null;
  if (neighbour && dir)
    next = exitsFull(neighbour)
      ? addExit(next, room.id, OPPOSITE[dir], neighbour.id, false)
      : addExit(next, neighbour.id, dir, room.id, true);
  return { doc: next, roomId: room.id };
}

export function updateRoom(
  doc: StoryProject,
  id: string,
  change: (room: RoomDef) => RoomDef,
): StoryProject {
  return setWorld(doc, (w) => ({
    ...w,
    rooms: w.rooms.map((r) => (r.id === id ? change(r) : r)),
  }));
}

/** Removes a room and every exit that led into it. Its passage stays. */
export function deleteRoom(doc: StoryProject, id: string): StoryProject {
  return setWorld(doc, (w) => ({
    ...w,
    rooms: w.rooms
      .filter((r) => r.id !== id)
      .map((r) => ({ ...r, exits: r.exits.filter((e) => e.to !== id) })),
  }));
}

/** An exit from one room to another; two-way also adds the opposite exit back, if missing. */
export function addExit(
  doc: StoryProject,
  from: string,
  dir: Direction,
  to: string,
  twoWay: boolean,
): StoryProject {
  const room = worldOf(doc).rooms.find((r) => r.id === from);
  if (!room || exitsFull(room)) return doc;
  const exit: ExitDef = { id: createId('ex'), dir, to };
  let next = updateRoom(doc, from, (r) => ({ ...r, exits: [...r.exits, exit] }));
  const target = worldOf(next).rooms.find((r) => r.id === to);
  // A target with no room for the way back keeps the new exit one-way.
  if (twoWay && to && target && !exitsFull(target) && !target.exits.some((e) => e.to === from)) {
    const back: ExitDef = { id: createId('ex'), dir: OPPOSITE[dir], to: from };
    next = updateRoom(next, to, (r) => ({ ...r, exits: [...r.exits, back] }));
  }
  return next;
}

export function updateExit(
  doc: StoryProject,
  roomId: string,
  exitId: string,
  change: (exit: ExitDef) => ExitDef,
): StoryProject {
  return updateRoom(doc, roomId, (r) => ({
    ...r,
    exits: r.exits.map((e) => (e.id === exitId ? change(e) : e)),
  }));
}

export function removeExit(doc: StoryProject, roomId: string, exitId: string): StoryProject {
  return updateRoom(doc, roomId, (r) => ({ ...r, exits: r.exits.filter((e) => e.id !== exitId) }));
}

/** A direction for a new exit: towards the target if it is next door, else the first free one. */
export function suggestDirection(from: RoomDef, to: RoomDef | undefined): Direction {
  const between = to ? directionBetween(from, to) : null;
  if (between) return between;
  const used = new Set(from.exits.map((e) => e.dir));
  return (
    (['n', 'e', 's', 'w', 'up', 'down', 'in', 'out'] as const).find((d) => !used.has(d)) ?? 'n'
  );
}

/** Whether a room's passage already ends in an Exits block. */
export function endsWithExits(doc: StoryProject, passageId: string): boolean {
  for (const chapter of doc.chapters)
    for (const passage of chapter.passages)
      if (passage.id === passageId) return passage.blocks.at(-1)?.type === 'exits';
  return false;
}

export function appendExitsBlock(doc: StoryProject, passageId: string): StoryProject {
  const exits: Block = { id: createId('b'), type: 'exits' };
  return {
    ...doc,
    chapters: doc.chapters.map((c) => ({
      ...c,
      passages: c.passages.map((p) =>
        p.id === passageId ? { ...p, blocks: [...p.blocks, exits] } : p,
      ),
    })),
  };
}

// --- spaces ------------------------------------------------------------------------------

export function addSpace(
  doc: StoryProject,
  kind: SpaceKind,
  name: Label,
  screen?: string,
): StoryProject {
  const spaces = doc.spaces ?? [];
  if (spaces.length >= MAX_SPACES) return doc;
  const space: SpaceDef = {
    id: createId('sp'),
    name,
    // A map usually sits to the left of the story, notes to the right.
    side: kind === 'map' ? 'left' : 'right',
    kind,
    ...(kind === 'screen' ? { screen: screen ?? '' } : {}),
  };
  return { ...doc, spaces: [...spaces, space] };
}

export function updateSpace(
  doc: StoryProject,
  id: string,
  change: (space: SpaceDef) => SpaceDef,
): StoryProject {
  return { ...doc, spaces: (doc.spaces ?? []).map((s) => (s.id === id ? change(s) : s)) };
}

export function removeSpace(doc: StoryProject, id: string): StoryProject {
  const spaces = (doc.spaces ?? []).filter((s) => s.id !== id);
  if (spaces.length) return { ...doc, spaces };
  const { spaces: _gone, ...rest } = doc;
  return rest;
}

/** Moves a space one place earlier or later in the list (its side keeps it left or right). */
export function moveSpace(doc: StoryProject, id: string, delta: -1 | 1): StoryProject {
  const spaces = [...(doc.spaces ?? [])];
  const from = spaces.findIndex((s) => s.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= spaces.length) return doc;
  const [space] = spaces.splice(from, 1);
  if (space) spaces.splice(to, 0, space);
  return { ...doc, spaces };
}
