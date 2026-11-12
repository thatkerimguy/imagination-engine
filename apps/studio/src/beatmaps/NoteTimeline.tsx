import { beatLength, gridLines, readPalette, snapTime } from '@ie/rhythm';
import { objectEnd, type BeatmapDef, type HitObject } from '@ie/story';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { retimeObjects, setObject } from './beatmap-edit.ts';
import { PEAK_MS, type EditorTime } from './editor-time.ts';

type Drag =
  | { readonly kind: 'retime'; readonly ids: ReadonlySet<string>; readonly dt: number; readonly from: number }
  | { readonly kind: 'tail'; readonly id: string; readonly end: number }
  /** Panning the timeline: a click without movement seeks to where it landed. */
  | { readonly kind: 'pan'; readonly x: number; readonly t: number; readonly moved: boolean };

interface Scene {
  readonly map: BeatmapDef;
  readonly selected: ReadonlySet<string>;
  readonly divisor: number;
  readonly span: number;
  readonly peaks: Float32Array | null;
}

const NOTE_R = 7;

function applyDrag(map: BeatmapDef, drag: Drag | null): BeatmapDef {
  if (drag?.kind === 'retime') return retimeObjects(map, drag.ids, drag.dt);
  if (drag?.kind === 'tail')
    return setObject(map, drag.id, (o) => (o.kind === 'circle' ? o : { ...o, end: drag.end }));
  return map;
}

export interface NoteTimelineProps {
  readonly map: BeatmapDef;
  readonly time: EditorTime;
  readonly selected: ReadonlySet<string>;
  readonly divisor: number;
  /** Milliseconds across the whole timeline. */
  readonly span: number;
  readonly peaks: Float32Array | null;
  readonly label: string;
  readonly onSeek: (t: number) => void;
  /** Panning: called as it goes, then once with `done` when the pointer lets go. */
  readonly onScrub: (t: number, done: boolean) => void;
  readonly onSelect: (ids: ReadonlySet<string>) => void;
  readonly onCommit: (change: (map: BeatmapDef) => BeatmapDef) => void;
  readonly onWheelStep: (direction: 1 | -1) => void;
  readonly onZoom: (direction: 1 | -1) => void;
}

/**
 * The song from left to right with the playhead in the middle: waveform, beat grid, tempo
 * changes and notes. Drag a note to move it in time, its tail to lengthen it, the rest to scrub.
 */
export function NoteTimeline(props: NoteTimelineProps) {
  const { map, time, selected, divisor, span, peaks } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drag, setDragState] = useState<Drag | null>(null);
  // Pointer events can outrun renders, so handlers read the drag from here, not from state.
  const live = useRef<Drag | null>(null);
  const setDrag = (next: Drag | null) => {
    live.current = next;
    setDragState(next);
  };
  const preview = useMemo(() => applyDrag(map, drag), [map, drag]);
  const scene = useRef<Scene | null>(null);
  const handlers = useRef(props);
  const frame = useRef(0);

  const paint = useCallback(() => {
    frame.current = 0;
    const canvas = canvasRef.current;
    const s = scene.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !s || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const palette = readPalette(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const from = time.t - s.span / 2;
    const to = time.t + s.span / 2;
    const x = (t: number) => ((t - from) / s.span) * w;

    // Before the song starts.
    if (x(0) > 0) {
      ctx.fillStyle = palette.line;
      ctx.fillRect(0, 0, Math.min(w, x(0)), h);
    }
    if (s.peaks) {
      ctx.fillStyle = palette.faint;
      ctx.globalAlpha = 0.45;
      const mid = h * 0.62;
      for (let px = 0; px < w; px++) {
        const a = Math.floor((from + (px / w) * s.span) / PEAK_MS);
        const b = Math.max(a + 1, Math.floor((from + ((px + 1) / w) * s.span) / PEAK_MS));
        let peak = 0;
        for (let k = Math.max(0, a); k < Math.min(s.peaks.length, b); k++)
          peak = Math.max(peak, s.peaks[k] as number);
        const amp = peak * h * 0.34;
        if (amp > 0.5) ctx.fillRect(px, mid - amp, 1, amp * 2);
      }
      ctx.globalAlpha = 1;
    }

    for (const line of gridLines(s.map.timing, from, to, s.divisor, 800)) {
      const lx = Math.round(x(line.t)) + 0.5;
      ctx.strokeStyle = line.strength === 'sub' ? palette.line : palette.lineStrong;
      ctx.lineWidth = line.strength === 'bar' ? 2 : 1;
      const top = line.strength === 'bar' ? 0 : line.strength === 'beat' ? h * 0.25 : h * 0.45;
      ctx.beginPath();
      ctx.moveTo(lx, top);
      ctx.lineTo(lx, h);
      ctx.stroke();
    }

    ctx.font = `600 10px ${palette.font}`;
    ctx.textBaseline = 'top';
    for (const p of s.map.timing) {
      if (p.t < from - 100 || p.t > to) continue;
      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      ctx.moveTo(x(p.t) - 5, 0);
      ctx.lineTo(x(p.t) + 5, 0);
      ctx.lineTo(x(p.t), 7);
      ctx.fill();
      ctx.fillText(`${Math.round(p.bpm * 100) / 100}`, x(p.t) + 7, 1);
    }

    const y = h * 0.62;
    let comboIndex = -1;
    s.map.objects.forEach((o, i) => {
      const prev = s.map.objects[i - 1];
      if (i === 0 || o.combo || o.kind === 'spinner' || prev?.kind === 'spinner') comboIndex++;
      if (objectEnd(o) < from - NOTE_R || o.t > to + NOTE_R) return;
      const on = s.selected.has(o.id);
      const colour = comboIndex % 2 === 0 ? palette.accent : palette.ink;
      if (o.kind !== 'circle') {
        ctx.fillStyle = on ? palette.accent : palette.surface;
        ctx.strokeStyle = colour;
        ctx.lineWidth = 2;
        if (o.kind === 'spinner') ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.roundRect(x(o.t), y - NOTE_R, Math.max(2, x(o.end) - x(o.t)), NOTE_R * 2, NOTE_R);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        if (o.kind === 'slider' && o.slides > 1) {
          ctx.fillStyle = colour;
          for (let k = 1; k < o.slides; k++) {
            const rx = x(o.t + ((o.end - o.t) * k) / o.slides);
            ctx.fillRect(rx - 1, y - NOTE_R + 2, 2, NOTE_R * 2 - 4);
          }
        }
      }
      ctx.fillStyle = on ? palette.accent : palette.surface;
      ctx.strokeStyle = on ? palette.ink : colour;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x(o.t), y, NOTE_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.round(w / 2), 0);
    ctx.lineTo(Math.round(w / 2), h);
    ctx.stroke();
  }, [time]);

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(paint);
  }, [paint]);

  useEffect(() => {
    scene.current = { map: preview, selected, divisor, span, peaks };
    handlers.current = props;
    schedule();
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const unsubscribe = time.subscribe(schedule);
    const resize = new ResizeObserver(schedule);
    if (canvas) resize.observe(canvas);
    // React's wheel listener is passive, and the timeline must keep the page from scrolling.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const direction = e.deltaY > 0 || e.deltaX > 0 ? 1 : -1;
      if (e.ctrlKey || e.metaKey) handlers.current.onZoom(direction);
      else handlers.current.onWheelStep(direction);
    };
    canvas?.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      unsubscribe();
      resize.disconnect();
      canvas?.removeEventListener('wheel', onWheel);
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [time, schedule]);

  const timeAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    return time.t - span / 2 + ((e.clientX - box.left) / Math.max(1, box.width)) * span;
  };
  const pxPerMs = (e: React.PointerEvent<HTMLCanvasElement>) =>
    e.currentTarget.getBoundingClientRect().width / span;

  const noteAt = (e: React.PointerEvent<HTMLCanvasElement>): { o: HitObject; tail: boolean } | null => {
    const at = timeAt(e);
    const reach = NOTE_R / pxPerMs(e);
    const box = e.currentTarget.getBoundingClientRect();
    const dy = Math.abs(e.clientY - box.top - box.height * 0.62);
    if (dy > NOTE_R + 4) return null;
    // Later notes are drawn on top, so they are found first.
    for (let i = map.objects.length - 1; i >= 0; i--) {
      const o = map.objects[i] as HitObject;
      if (o.kind !== 'circle' && Math.abs(at - o.end) <= reach * 0.8) return { o, tail: true };
      if (Math.abs(at - o.t) <= reach) return { o, tail: false };
      if (o.kind !== 'circle' && at > o.t && at < o.end) return { o, tail: false };
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const hit = noteAt(e);
    if (!hit) return setDrag({ kind: 'pan', x: e.clientX, t: time.t, moved: false });
    const id = hit.o.id;
    if (hit.tail) {
      props.onSelect(new Set([id]));
      return setDrag({ kind: 'tail', id, end: objectEnd(hit.o) });
    }
    let ids: ReadonlySet<string> = selected.has(id) ? selected : new Set([id]);
    if (e.shiftKey) {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      ids = next;
    }
    props.onSelect(ids);
    if (ids.has(id)) setDrag({ kind: 'retime', ids, dt: 0, from: hit.o.t });
  };

  const snap = (at: number, free: boolean) => (free ? at : snapTime(map.timing, at, divisor));

  /** The drag after the pointer moved to `e` (panning seeks as it goes). */
  const follow = (e: React.PointerEvent<HTMLCanvasElement>, d: Drag): Drag => {
    if (d.kind === 'pan') {
      const dx = e.clientX - d.x;
      if (!d.moved && Math.abs(dx) < 4) return d;
      props.onScrub(Math.max(0, d.t - dx / pxPerMs(e)), false);
      return { ...d, moved: true };
    }
    const at = timeAt(e);
    if (d.kind === 'retime') return { ...d, dt: Math.round(snap(at, e.shiftKey) - d.from) };
    const o = map.objects.find((n) => n.id === d.id);
    if (!o) return d;
    const step = beatLength(map.timing, o.t) / divisor;
    return { ...d, end: Math.round(Math.max(o.t + step, snap(at, e.shiftKey))) };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (live.current) setDrag(follow(e, live.current));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const current = live.current;
    if (!current) return;
    const done = follow(e, current);
    setDrag(null);
    if (done.kind === 'pan') {
      if (done.moved) props.onScrub(time.t, true);
      else props.onSeek(Math.max(0, snap(timeAt(e), e.shiftKey)));
      return;
    }
    if (done.kind === 'retime' && done.dt === 0) return;
    props.onCommit((m) => applyDrag(m, done));
  };

  return (
    <canvas
      ref={canvasRef}
      className="bmed__timeline"
      data-testid="bmed-timeline"
      role="img"
      aria-label={props.label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        if (live.current?.kind === 'pan' && live.current.moved) props.onScrub(time.t, true);
        setDrag(null);
      }}
    />
  );
}
