import { z } from 'zod';
import type { Formula, Label, LocalText } from './schema.ts';

/*
 * The open world (ADR 0031): rooms on a grid, joined by exits, each played by a passage; the
 * Exits block that offers the current room's ways out; and spaces, the views beside the story a
 * reader swipes to (a map of the rooms, or one of the story's panel screens). Like rpg.ts, this
 * never imports schema.ts at run time (an import cycle), so it keeps its own small schemas.
 */

const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'IDs use letters, digits and _');
/** A reference; empty means not chosen yet (see refSchema in schema.ts). */
const ref = z.union([id, z.literal('')]);
const label = z.object({ en: z.string().optional(), tr: z.string().optional() });
const localText = z.object({ id, en: z.string().optional(), tr: z.string().optional() });
const formula = z.union([z.string(), z.number(), z.boolean()]);

/** Compass points first (they place a room next to another on the map), then the rest. */
export const DIRECTIONS = [
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
  'nw',
  'up',
  'down',
  'in',
  'out',
] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** Grid step of each compass direction; y grows southwards, like the screen. */
export const DIRECTION_STEP: Readonly<Record<Direction, readonly [number, number] | null>> = {
  n: [0, -1],
  ne: [1, -1],
  e: [1, 0],
  se: [1, 1],
  s: [0, 1],
  sw: [-1, 1],
  w: [-1, 0],
  nw: [-1, -1],
  up: null,
  down: null,
  in: null,
  out: null,
};

export const OPPOSITE: Readonly<Record<Direction, Direction>> = {
  n: 's',
  ne: 'sw',
  e: 'w',
  se: 'nw',
  s: 'n',
  sw: 'ne',
  w: 'e',
  nw: 'se',
  up: 'down',
  down: 'up',
  in: 'out',
  out: 'in',
};

/** The compass direction from one grid square to a neighbouring one, if they touch. */
export function directionBetween(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return (
    DIRECTIONS.find((d) => {
      const step = DIRECTION_STEP[d];
      return step !== null && step[0] === dx && step[1] === dy;
    }) ?? null
  );
}

/** A way out of a room. Hidden or locked like a choice option. */
export interface ExitDef {
  readonly id: string;
  readonly dir: Direction;
  /** The room it leads to. */
  readonly to: string;
  /** Words instead of the direction's name ("Through the hatch"). */
  readonly label?: LocalText;
  /** Hidden entirely while false. */
  readonly visibleIf?: Formula;
  /** Shown locked, with a reason, while false. */
  readonly enabledIf?: Formula;
  readonly lockedText?: LocalText;
}
export const exitSchema = z.object({
  id,
  dir: z.enum(DIRECTIONS),
  to: ref,
  label: localText.optional(),
  visibleIf: formula.optional(),
  enabledIf: formula.optional(),
  lockedText: localText.optional(),
});

export const WORLD_SIZE = 64;

export interface RoomDef {
  readonly id: string;
  readonly name: Label;
  /** The passage that plays when the reader walks in. Entering it any way puts them here. */
  readonly passage: string;
  /** Square on the map grid. */
  readonly x: number;
  readonly y: number;
  readonly exits: readonly ExitDef[];
  /** Never drawn on the map until the reader has been here. */
  readonly secret?: boolean;
}
export const roomSchema = z.object({
  id,
  name: label,
  passage: ref,
  x: z.number().int().min(-WORLD_SIZE).max(WORLD_SIZE),
  y: z.number().int().min(-WORLD_SIZE).max(WORLD_SIZE),
  exits: z.array(exitSchema).max(12),
  secret: z.boolean().optional(),
});

/**
 * What the map shows: only rooms the reader has been in, those plus the rooms their exits lead
 * to (drawn as unknown), or every room that isn't secret.
 */
export const MAP_REVEALS = ['visited', 'nearby', 'all'] as const;
export type MapReveal = (typeof MAP_REVEALS)[number];

export interface WorldDef {
  readonly rooms: readonly RoomDef[];
  /** From an Exits block, the map can take the reader to any room they have been in. */
  readonly fastTravel?: boolean;
  readonly reveal?: MapReveal;
}
export const worldSchema = z.object({
  rooms: z.array(roomSchema).max(400),
  fastTravel: z.boolean().optional(),
  reveal: z.enum(MAP_REVEALS).optional(),
});

/** Offers the ways out of the room the reader is in; picking one walks there. */
export interface ExitsBlock {
  readonly id: string;
  readonly type: 'exits';
  readonly prompt?: LocalText;
}
export const exitsBlockSchema = z.object({
  id,
  type: z.literal('exits'),
  prompt: localText.optional(),
});

/** A view beside the story: the reader swipes (or clicks the screen's edge) to reach it. */
export const SPACE_SIDES = ['left', 'right'] as const;
export type SpaceSide = (typeof SPACE_SIDES)[number];

export const SPACE_KINDS = ['map', 'screen'] as const;
export type SpaceKind = (typeof SPACE_KINDS)[number];

export interface SpaceDef {
  readonly id: string;
  readonly name: Label;
  readonly side: SpaceSide;
  readonly kind: SpaceKind;
  /** A panel screen to show (kind `screen`). */
  readonly screen?: string;
}
export const spaceSchema = z.object({
  id,
  name: label,
  side: z.enum(SPACE_SIDES),
  kind: z.enum(SPACE_KINDS),
  screen: ref.optional(),
});
export const MAX_SPACES = 6;

/** The spaces in reading order, left to right, with the story's own place between them. */
export function spaceOrder(spaces: readonly SpaceDef[]): readonly (SpaceDef | 'story')[] {
  const left = spaces.filter((s) => s.side === 'left');
  const right = spaces.filter((s) => s.side === 'right');
  // The first left space sits right next to the story, so the left ones read outwards.
  return [...left.toReversed(), 'story', ...right];
}
