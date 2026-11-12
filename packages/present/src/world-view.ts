import type { Translator } from '@ie/i18n';
import {
  DIRECTION_STEP,
  pickLabel,
  plainText,
  type Beat,
  type ExitDef,
  type LocalText,
  type MapView,
  type StoryRuntime,
} from '@ie/story';
import { lockText } from './labels.ts';
import type { PresentKey } from './messages.ts';

/*
 * The open world on the page (ADR 0031): the Exits block's ways out, the line a walk leaves in
 * the backlog, and the map a space shows. Rooms are buttons, so the map works with a keyboard
 * and a screen reader; the lines between them are a single SVG underneath.
 */

export type ExitsBeat = Extract<Beat, { kind: 'exits' }>;
export type WentBeat = Extract<Beat, { kind: 'went' }>;

export interface WorldContext {
  readonly runtime: StoryRuntime;
  readonly t: Translator<PresentKey>;
}

export interface WorldHandlers {
  /** Walk to a room from the waiting Exits block. */
  go(roomId: string): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function words(ctx: WorldContext, text: LocalText | undefined): string {
  return text ? plainText(ctx.runtime.render(text, ctx.t.locale)) : '';
}

export function roomName(ctx: WorldContext, roomId: string): string {
  const room = ctx.runtime.story.rooms.get(roomId);
  return room ? pickLabel(room.name, ctx.t.locale, room.id) : roomId;
}

function findExit(ctx: WorldContext, roomId: string, exitId: string): ExitDef | undefined {
  return ctx.runtime.story.rooms.get(roomId)?.exits.find((e) => e.id === exitId);
}

/** "North · Library", or the author's own words for the exit. */
function exitText(ctx: WorldContext, exit: ExitDef): string {
  const own = words(ctx, exit.label);
  if (own) return own;
  return ctx.t('exits.to', {
    dir: ctx.t(`dir.${exit.dir}` as PresentKey),
    room: roomName(ctx, exit.to),
  });
}

/** The ways out of the current room, as choice buttons (number keys pick them too). */
export function buildExits(
  beat: ExitsBeat,
  ctx: WorldContext,
  handlers: WorldHandlers,
): HTMLElement {
  const block = ctx.runtime.story.blocks.get(beat.blockId)?.block;
  const prompt = block?.type === 'exits' ? words(ctx, block.prompt) : '';
  const group = el('div', 'choices choices--exits');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', prompt || ctx.t('exits.label'));
  group.dataset.testid = 'exits';
  if (prompt) group.append(el('p', 'choices__prompt', prompt));
  const list = el('div', 'choices__list');
  beat.exits.forEach((view, index) => {
    const exit = findExit(ctx, beat.room, view.id);
    if (!exit) return;
    const button = el('button', 'choice');
    button.type = 'button';
    button.dataset.testid = 'exit';
    button.dataset.room = view.to;
    const body = el('span', 'choice__body');
    body.append(el('span', 'choice__text', exitText(ctx, exit)));
    if (!view.enabled && view.lock) {
      const own = exit.lockedText ? words(ctx, exit.lockedText) : undefined;
      body.append(el('span', 'choice__note', lockText(view.lock, ctx.runtime.story, ctx.t, own)));
      button.setAttribute('aria-disabled', 'true');
      button.dataset.locked = 'true';
    }
    const key = el('span', 'choice__key', String(index + 1));
    key.setAttribute('aria-hidden', 'true');
    button.append(key, body);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (view.enabled) handlers.go(view.to);
    });
    list.append(button);
  });
  group.append(list);
  return group;
}

/** What the backlog keeps of a walk: the exit taken, or "Travelled to the hall". */
export function wentText(beat: WentBeat, ctx: WorldContext): string {
  const block = ctx.runtime.story.blocks.get(beat.blockId);
  // Saves made before `from` was kept fall back to the room that owns the block's passage.
  const from = beat.from ?? (block ? ctx.runtime.story.roomOf.get(block.passage) : undefined);
  const exit = beat.exit && from ? findExit(ctx, from, beat.exit) : undefined;
  return exit ? exitText(ctx, exit) : ctx.t('went.travel', { room: roomName(ctx, beat.room) });
}

const CELL = 88;
const ROOM_W = 72;
const ROOM_H = 44;

/**
 * The map of the rooms the reader knows. A reachable room is a live button that walks there;
 * the others are focusable but inert, so they can still be read out.
 */
export function buildMap(view: MapView, ctx: WorldContext, handlers: WorldHandlers): HTMLElement {
  const wrap = el('div', 'world-map');
  wrap.dataset.testid = 'world-map';
  if (view.rooms.length === 0) {
    wrap.append(el('p', 'world-map__empty', ctx.t('map.empty')));
    return wrap;
  }
  const xs = view.rooms.map((r) => r.x);
  const ys = view.rooms.map((r) => r.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = (Math.max(...xs) - minX + 1) * CELL;
  const height = (Math.max(...ys) - minY + 1) * CELL;
  const centre = (x: number, y: number) => [(x - minX + 0.5) * CELL, (y - minY + 0.5) * CELL];

  const board = el('div', 'world-map__board');
  board.style.width = `${width}px`;
  board.style.height = `${height}px`;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'world-map__links');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('aria-hidden', 'true');
  const at = new Map(view.rooms.map((r) => [r.id, r]));
  const drawn = new Set<string>();
  for (const link of view.links) {
    const a = at.get(link.from);
    const b = at.get(link.to);
    const key = [link.from, link.to].sort().join('|');
    if (!a || !b || drawn.has(key)) continue;
    drawn.add(key);
    const [x1, y1] = centre(a.x, a.y);
    const [x2, y2] = centre(b.x, b.y);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    // Stairs, doors "in" and long passages don't follow the grid: drawn dashed.
    const step = DIRECTION_STEP[link.dir];
    const neighbours = step !== null && b.x - a.x === step[0] && b.y - a.y === step[1];
    if (!neighbours) line.setAttribute('data-indirect', 'true');
    svg.append(line);
  }
  board.append(svg);

  for (const room of view.rooms) {
    const name = room.state === 'unknown' ? ctx.t('map.unknown') : roomName(ctx, room.id);
    const button = el('button', 'world-map__room');
    button.type = 'button';
    button.dataset.state = room.state;
    button.dataset.testid = 'map-room';
    button.dataset.room = room.id;
    const [cx, cy] = centre(room.x, room.y);
    button.style.left = `${(cx ?? 0) - ROOM_W / 2}px`;
    button.style.top = `${(cy ?? 0) - ROOM_H / 2}px`;
    button.style.width = `${ROOM_W}px`;
    button.style.height = `${ROOM_H}px`;
    button.append(el('span', 'world-map__name', name));
    if (room.state === 'here') {
      button.setAttribute('aria-current', 'location');
      button.title = ctx.t('map.here');
    }
    if (room.reachable) {
      button.dataset.reachable = 'true';
      button.setAttribute('aria-label', ctx.t('map.go', { room: name }));
      button.addEventListener('click', () => handlers.go(room.id));
    } else button.setAttribute('aria-disabled', 'true');
    board.append(button);
  }
  wrap.append(board);
  return wrap;
}
