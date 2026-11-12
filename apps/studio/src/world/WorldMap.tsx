import {
  DIRECTION_STEP,
  directionBetween,
  MAX_ROOMS,
  type RoomDef,
  type StoryProject,
} from '@ie/story';
import { Plus } from 'lucide-react';
import { useProject } from '../project/store.ts';
import { useT } from '../store.ts';
import { labelText, nextName } from '../write/edit.ts';
import { addRoom, worldFull, worldOf } from './world-edit.ts';

const CELL = 84;
const LIMIT = 64;

interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly cols: number;
  readonly rows: number;
}

/** The rooms plus a ring of empty squares to grow into (a 5 × 5 field when there are none). */
function boundsOf(rooms: readonly RoomDef[]): Bounds {
  if (rooms.length === 0) return { minX: -2, minY: -2, cols: 5, rows: 5 };
  const xs = rooms.map((r) => r.x);
  const ys = rooms.map((r) => r.y);
  const minX = Math.max(-LIMIT, Math.min(...xs) - 1);
  const minY = Math.max(-LIMIT, Math.min(...ys) - 1);
  const maxX = Math.min(LIMIT, Math.max(...xs) + 1);
  const maxY = Math.min(LIMIT, Math.max(...ys) + 1);
  return { minX, minY, cols: maxX - minX + 1, rows: maxY - minY + 1 };
}

/**
 * The world as a grid of squares: rooms are buttons, empty squares add a room, and one next to the
 * selected room adds a room already joined to it both ways.
 */
export function WorldMap({
  doc,
  selected,
  onSelect,
}: {
  readonly doc: StoryProject;
  readonly selected: string | null;
  readonly onSelect: (roomId: string) => void;
}) {
  const t = useT();
  const edit = useProject((s) => s.edit);
  const rooms = worldOf(doc).rooms;
  const bounds = boundsOf(rooms);
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const at = new Map(rooms.map((r) => [`${r.x},${r.y}`, r]));
  const current = selected ? byId.get(selected) : undefined;
  const full = worldFull(doc);
  const centre = (x: number, y: number) =>
    [(x - bounds.minX + 0.5) * CELL, (y - bounds.minY + 0.5) * CELL] as const;

  const add = (x: number, y: number) => {
    const name = nextName(
      t('world.roomBase'),
      rooms.map((r) => r.name.en ?? ''),
    );
    const joinTo = current && directionBetween(current, { x, y }) ? current.id : undefined;
    let made = '';
    edit((d) => {
      const result = addRoom(d, { x, y }, { en: name, tr: name }, name, joinTo);
      made = result.roomId;
      return result.doc;
    });
    if (made) onSelect(made);
  };

  const lines: { key: string; x1: number; y1: number; x2: number; y2: number; bent: boolean }[] =
    [];
  const drawn = new Set<string>();
  for (const room of rooms)
    for (const exit of room.exits) {
      const target = byId.get(exit.to);
      const key = [room.id, exit.to].sort().join('|');
      if (!target || drawn.has(key)) continue;
      drawn.add(key);
      const [x1, y1] = centre(room.x, room.y);
      const [x2, y2] = centre(target.x, target.y);
      const step = DIRECTION_STEP[exit.dir];
      const bent = !step || target.x - room.x !== step[0] || target.y - room.y !== step[1];
      lines.push({ key, x1, y1, x2, y2, bent });
    }

  const width = bounds.cols * CELL;
  const height = bounds.rows * CELL;
  const cells = [];
  for (let row = 0; row < bounds.rows; row++)
    for (let col = 0; col < bounds.cols; col++) {
      const x = bounds.minX + col;
      const y = bounds.minY + row;
      const room = at.get(`${x},${y}`);
      const style = { left: col * CELL, top: row * CELL, width: CELL, height: CELL };
      if (room) {
        cells.push(
          <button
            key={room.id}
            type="button"
            className="wmap__room"
            style={style}
            aria-pressed={room.id === selected}
            data-secret={room.secret ? 'true' : undefined}
            data-testid="wmap-room"
            onClick={() => onSelect(room.id)}
          >
            <span>{labelText(room.name, t.locale, room.id)}</span>
          </button>,
        );
        continue;
      }
      const joined = current && directionBetween(current, { x, y });
      const label = full
        ? t('world.roomsFull', { n: MAX_ROOMS })
        : joined
          ? t('world.addJoined', { name: labelText(current.name, t.locale, current.id) })
          : t('world.addAt');
      cells.push(
        <button
          key={`${x},${y}`}
          type="button"
          className="wmap__cell"
          style={style}
          aria-label={label}
          title={label}
          data-joined={joined ? 'true' : undefined}
          data-testid="wmap-cell"
          data-x={x}
          data-y={y}
          disabled={full}
          onClick={() => add(x, y)}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>,
      );
    }

  return (
    <div className="wmap" role="group" aria-label={t('world.map')} data-testid="world-editor-map">
      <div className="wmap__board" style={{ width, height }}>
        <svg className="wmap__links" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          {lines.map((l) => (
            <line
              key={l.key}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              data-bent={l.bent ? 'true' : undefined}
            />
          ))}
        </svg>
        {cells}
      </div>
    </div>
  );
}
