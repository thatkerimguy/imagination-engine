import { lockFor } from './choices.ts';
import { truthy } from './formula.ts';
import type { RuntimeCore } from './runtime-core.ts';
import type { Label } from './schema.ts';
import type { ExitView, Mutable } from './state.ts';
import type { Direction, ExitsBlock, RoomDef } from './world.ts';

/*
 * The open world at run time (ADR 0031). Entering a room's passage, by any route, puts the reader
 * in that room; an Exits block waits for them to pick a way out (or a room on the map); and the
 * map is drawn from mapView(), which knows where the reader may go from here.
 */

/** Called whenever a passage begins: a room passage moves the reader into its room. */
export function enterRoom(core: RuntimeCore, passageId: string): void {
  const roomId = core.story.roomOf.get(passageId);
  if (!roomId) return;
  const s = core.s;
  s.room = roomId;
  if (!s.rooms?.includes(roomId)) s.rooms = [...(s.rooms ?? []), roomId];
}

/** The current room's exits as the reader sees them now: hidden ones left out. */
export function exitViews(core: RuntimeCore, room: RoomDef): ExitView[] {
  const views: ExitView[] = [];
  for (const exit of room.exits) {
    if (!core.story.rooms.has(exit.to)) continue;
    if (exit.visibleIf !== undefined && !truthy(core.compute(exit.visibleIf))) continue;
    const view: Mutable<ExitView> = { id: exit.id, to: exit.to, enabled: true };
    if (exit.enabledIf !== undefined && !truthy(core.compute(exit.enabledIf))) {
      view.enabled = false;
      view.lock = lockFor(exit.enabledIf, exit.lockedText !== undefined, core.optionContext);
    }
    views.push(view);
  }
  return views;
}

function currentRoom(core: RuntimeCore): RoomDef | undefined {
  return core.s.room ? core.story.rooms.get(core.s.room) : undefined;
}

/** Rooms the map can take the reader to from an Exits block, besides the exits themselves. */
function travelTargets(core: RuntimeCore): readonly string[] {
  if (!core.story.project.world?.fastTravel) return [];
  return (core.s.rooms ?? []).filter((id) => id !== core.s.room && core.story.rooms.has(id));
}

/** An Exits block waits for the reader, unless there is nowhere to go. */
export function runExits(core: RuntimeCore, block: ExitsBlock): boolean {
  const room = currentRoom(core);
  if (!room) return false;
  const exits = exitViews(core, room);
  if (exits.length === 0 && travelTargets(core).length === 0) return false;
  return core.wait({ kind: 'exits', blockId: block.id, room: room.id, exits });
}

/**
 * Walks to a room from the waiting Exits block: through an open exit, or by fast travel to a
 * room already visited. The room's passage begins, like a Jump.
 */
export function travel(core: RuntimeCore, roomId: string): void {
  const beat = core.waiting;
  if (beat?.kind !== 'exits') throw new Error('There are no exits waiting.');
  const room = currentRoom(core);
  const exit = room ? exitViews(core, room).find((e) => e.to === roomId && e.enabled) : undefined;
  if (!exit && !travelTargets(core).includes(roomId))
    throw new Error(`"${roomId}" can't be reached from here.`);
  const target = core.story.rooms.get(roomId);
  if (!target || !core.story.passages.has(target.passage))
    throw new Error(`The room "${roomId}" has no passage to play.`);
  core.resetScope('temp');
  core.record({
    kind: 'went',
    blockId: beat.blockId,
    room: roomId,
    ...(exit ? { exit: exit.id } : {}),
    ...(room ? { from: room.id } : {}),
  });
  core.s.waiting = null;
  while (core.s.frames.length && !core.s.frames.at(-1)?.call)
    core.s.frames = core.s.frames.slice(0, -1);
  core.enter(target.passage);
}

export type MapRoomState = 'here' | 'visited' | 'unknown';

export interface MapRoom {
  readonly id: string;
  readonly name: Label;
  readonly x: number;
  readonly y: number;
  readonly state: MapRoomState;
  /** The reader can walk (or travel) there now, from the waiting Exits block. */
  readonly reachable: boolean;
}

export interface MapLink {
  readonly from: string;
  readonly to: string;
  readonly dir: Direction;
}

export interface MapView {
  readonly rooms: readonly MapRoom[];
  readonly links: readonly MapLink[];
  readonly here: string | null;
}

/**
 * What the reader's map shows now. Unknown rooms are drawn without their names; links join two
 * drawn rooms through a visible exit of a visited room.
 */
export function mapView(core: RuntimeCore): MapView {
  const world = core.story.project.world;
  const visited = new Set(core.s.rooms ?? []);
  const here = core.s.room && core.story.rooms.has(core.s.room) ? core.s.room : null;
  const reveal = world?.reveal ?? 'nearby';
  const waiting = core.waiting?.kind === 'exits';
  const reachable = new Set<string>(waiting ? travelTargets(core) : []);
  const room = currentRoom(core);
  if (waiting && room)
    for (const exit of exitViews(core, room)) if (exit.enabled) reachable.add(exit.to);

  const shown = new Map<string, MapRoomState>();
  for (const def of world?.rooms ?? []) {
    if (def.id === here) shown.set(def.id, 'here');
    else if (visited.has(def.id)) shown.set(def.id, 'visited');
    else if (reveal === 'all' && !def.secret) shown.set(def.id, 'unknown');
  }
  const links: MapLink[] = [];
  for (const id of visited) {
    const def = core.story.rooms.get(id);
    if (!def) continue;
    for (const exit of exitViews(core, def)) {
      const target = core.story.rooms.get(exit.to);
      if (!target) continue;
      if (!shown.has(target.id) && reveal !== 'visited' && !target.secret)
        shown.set(target.id, 'unknown');
      if (shown.has(target.id)) links.push({ from: id, to: target.id, dir: exitDir(def, exit.id) });
    }
  }
  const rooms: MapRoom[] = [];
  for (const def of world?.rooms ?? []) {
    const state = shown.get(def.id);
    if (!state) continue;
    rooms.push({
      id: def.id,
      name: def.name,
      x: def.x,
      y: def.y,
      state,
      reachable: reachable.has(def.id),
    });
  }
  return { rooms, links, here };
}

function exitDir(room: RoomDef, exitId: string): Direction {
  return room.exits.find((e) => e.id === exitId)?.dir ?? 'n';
}
