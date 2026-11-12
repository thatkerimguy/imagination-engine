import {
  FieldPainter,
  fitField,
  playRules,
  prepareObjects,
  readPalette,
  screenTransform,
  sizeCanvas,
  toField,
  toScreen,
  type FieldLayout,
  type PlayObject,
  type PlayRules,
  type SampledPath,
} from '@ie/rhythm';
import { FIELD_HEIGHT, type BeatmapDef, type FieldPoint, type HitObject } from '@ie/story';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { moveObjects, setObject } from './beatmap-edit.ts';
import type { EditorTime } from './editor-time.ts';
import { clampToField, hitTest, type SliderDraft, type Tool } from './note-tools.ts';

type Drag =
  | {
      readonly kind: 'move';
      readonly ids: ReadonlySet<string>;
      readonly from: FieldPoint;
      readonly to: FieldPoint;
    }
  | {
      readonly kind: 'handle';
      readonly id: string;
      readonly index: number;
      readonly from: FieldPoint;
      readonly to: FieldPoint;
    };

interface Scene {
  readonly objects: readonly PlayObject[];
  readonly rules: PlayRules;
  readonly selected: ReadonlySet<string>;
  readonly draft: SliderDraft | null;
  readonly handles: readonly FieldPoint[];
}

const HANDLE_PX = 7;

const still = (drag: Drag) => drag.to.x === drag.from.x && drag.to.y === drag.from.y;

/** A drag shown before it is committed: notes moved, or one slider point dragged. */
function applyDrag(map: BeatmapDef, drag: Drag | null): BeatmapDef {
  if (!drag || still(drag)) return map;
  const dx = drag.to.x - drag.from.x;
  const dy = drag.to.y - drag.from.y;
  if (drag.kind === 'move') return moveObjects(map, drag.ids, dx, dy);
  return setObject(map, drag.id, (o) => {
    if (o.kind !== 'slider') return o;
    // The point moves as far as the pointer did, so grabbing it off-centre doesn't jump it.
    const was = drag.index < 0 ? o : o.path[drag.index];
    if (!was) return o;
    const to = clampToField({ x: was.x + dx, y: was.y + dy });
    // A reshaped slider follows its new path to the end, so an imported length no longer applies.
    const { length: _old, ...rest } = o;
    if (drag.index < 0) return { ...rest, x: to.x, y: to.y };
    return { ...rest, path: o.path.map((p, k) => (k === drag.index ? to : p)) };
  });
}

export interface NoteFieldProps {
  readonly map: BeatmapDef;
  readonly time: EditorTime;
  readonly tool: Tool;
  readonly selected: ReadonlySet<string>;
  readonly draft: SliderDraft | null;
  readonly label: string;
  readonly onSelect: (ids: ReadonlySet<string>) => void;
  /** A click anywhere on the field with a placing tool, including each bend of a slider. */
  readonly onPlace: (point: FieldPoint) => void;
  readonly onFinishSlider: () => void;
  readonly onCommit: (change: (map: BeatmapDef) => BeatmapDef) => void;
}

/** The play field at the playhead: notes drawn as players see them, placed and moved by pointer. */
export function NoteField(props: NoteFieldProps) {
  const { map, time, tool, selected, draft } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drag, setDragState] = useState<Drag | null>(null);
  // Pointer events can outrun renders, so handlers read the drag from here, not from state.
  const live = useRef<Drag | null>(null);
  const setDrag = (next: Drag | null) => {
    live.current = next;
    setDragState(next);
  };
  const rules = useMemo(() => playRules(map.difficulty), [map.difficulty]);
  const preview = useMemo(() => applyDrag(map, drag), [map, drag]);
  // Each move of a drag prepares the chart again; sliders it didn't touch reuse their paths.
  const [paths] = useState(() => new WeakMap<HitObject, SampledPath>());
  const objects = useMemo(() => prepareObjects(preview, rules, paths), [preview, rules, paths]);
  // The one selected slider shows its points as handles (Select tool only).
  const handles = useMemo(() => {
    if (tool !== 'select' || selected.size !== 1) return [];
    const o = preview.objects.find((n) => selected.has(n.id));
    return o?.kind === 'slider' ? [{ x: o.x, y: o.y }, ...o.path] : [];
  }, [tool, selected, preview]);

  const scene = useRef<Scene | null>(null);
  const layout = useRef<FieldLayout | null>(null);
  const hover = useRef<FieldPoint | null>(null);
  const painter = useRef<FieldPainter | null>(null);
  const frame = useRef(0);

  const paint = useCallback(() => {
    frame.current = 0;
    const canvas = canvasRef.current;
    const s = scene.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !s || !ctx) return;
    sizeCanvas(canvas);
    const palette = readPalette(canvas);
    const dpr = canvas.width / Math.max(1, canvas.clientWidth);
    const l = fitField(canvas.clientWidth, canvas.clientHeight, dpr, {
      top: 0,
      bottom: 0,
      pad: 0.07,
      allowRotate: false,
    });
    layout.current = l;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    screenTransform(ctx, l);
    const a = toScreen(l, 0, 0);
    const b = toScreen(l, 1, FIELD_HEIGHT);
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (let k = 1; k < 4; k++) {
      const x = a.x + ((b.x - a.x) * k) / 4;
      const y = a.y + ((b.y - a.y) * k) / 4;
      ctx.beginPath();
      ctx.moveTo(x, a.y);
      ctx.lineTo(x, b.y);
      ctx.moveTo(a.x, y);
      ctx.lineTo(b.x, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = palette.lineStrong;
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);

    const p = painter.current ?? new FieldPainter(ctx, palette);
    painter.current = p;
    p.palette = palette;
    p.draw(l, s.objects, { t: time.t, rules: s.rules, editor: { selected: s.selected } });

    ctx.lineWidth = 1.5;
    for (const h of s.handles) {
      const at = toScreen(l, h.x, h.y);
      ctx.fillStyle = palette.surface;
      ctx.strokeStyle = palette.accent;
      ctx.fillRect(at.x - HANDLE_PX / 2, at.y - HANDLE_PX / 2, HANDLE_PX, HANDLE_PX);
      ctx.strokeRect(at.x - HANDLE_PX / 2, at.y - HANDLE_PX / 2, HANDLE_PX, HANDLE_PX);
    }
    if (s.draft) {
      const points = hover.current ? [...s.draft.points, hover.current] : s.draft.points;
      ctx.strokeStyle = palette.accent;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      points.forEach((q, k) => {
        const at = toScreen(l, q.x, q.y);
        if (k === 0) ctx.moveTo(at.x, at.y);
        else ctx.lineTo(at.x, at.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      for (const q of s.draft.points) {
        const at = toScreen(l, q.x, q.y);
        ctx.fillStyle = palette.accent;
        ctx.fillRect(at.x - HANDLE_PX / 2, at.y - HANDLE_PX / 2, HANDLE_PX, HANDLE_PX);
      }
    }
  }, [time]);

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(paint);
  }, [paint]);

  useEffect(() => {
    scene.current = { objects, rules, selected, draft, handles };
    schedule();
  }, [objects, rules, selected, draft, handles, schedule]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const unsubscribe = time.subscribe(schedule);
    const resize = new ResizeObserver(schedule);
    if (canvas) resize.observe(canvas);
    return () => {
      unsubscribe();
      resize.disconnect();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [time, schedule]);

  const pointAt = (e: React.PointerEvent): FieldPoint | null => {
    const l = layout.current;
    if (!l) return null;
    const box = e.currentTarget.getBoundingClientRect();
    return toField(l, e.clientX - box.left, e.clientY - box.top);
  };

  const handleAt = (e: React.PointerEvent): number | null => {
    const l = layout.current;
    if (!l) return null;
    const box = e.currentTarget.getBoundingClientRect();
    const index = handles.findIndex((h) => {
      const at = toScreen(l, h.x, h.y);
      return Math.hypot(at.x - (e.clientX - box.left), at.y - (e.clientY - box.top)) <= HANDLE_PX;
    });
    return index < 0 ? null : index;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const p = pointAt(e);
    if (!p) return;
    e.currentTarget.focus();
    // A placing tool always places, so notes can stack on ones still showing; Select moves them.
    if (tool !== 'select') return props.onPlace(clampToField(p));
    const handle = handleAt(e);
    const only = [...selected][0];
    if (handle !== null && only) {
      e.currentTarget.setPointerCapture(e.pointerId);
      return setDrag({ kind: 'handle', id: only, index: handle - 1, from: p, to: p });
    }
    const hit = hitTest(objects, time.t, rules, p.x, p.y);
    if (!hit) {
      if (!e.shiftKey) props.onSelect(new Set());
      return;
    }
    const id = hit.source.id;
    let ids: ReadonlySet<string>;
    if (e.shiftKey) {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      ids = next;
    } else ids = selected.has(id) ? selected : new Set([id]);
    if (ids !== selected) props.onSelect(ids);
    if (!ids.has(id) || hit.kind === 'spinner') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ kind: 'move', ids, from: p, to: p });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pointAt(e);
    if (!p) return;
    if (live.current) return setDrag({ ...live.current, to: p });
    if (draft) {
      hover.current = clampToField(p);
      schedule();
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const current = live.current;
    if (!current) return;
    const p = pointAt(e);
    const done = p ? { ...current, to: p } : current;
    setDrag(null);
    // A click on a note or a handle selects it; only a real drag is an edit.
    if (still(done)) return;
    props.onCommit((m) => applyDrag(m, done));
  };

  return (
    <canvas
      ref={canvasRef}
      className="bmed__field"
      data-testid="bmed-field"
      data-tool={tool}
      tabIndex={0}
      role="img"
      aria-label={props.label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
      onPointerLeave={() => {
        hover.current = null;
        if (draft) schedule();
      }}
      onDoubleClick={() => {
        if (tool === 'slider' && draft) props.onFinishSlider();
      }}
    />
  );
}
