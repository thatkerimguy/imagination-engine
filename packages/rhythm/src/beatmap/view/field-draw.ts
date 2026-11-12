import { ballAt, type PlayObject } from '../prepare.ts';
import type { PlayRules } from '../rules.ts';
import {
  fieldTransform,
  screenTransform,
  toScreen,
  type FieldLayout,
  type FieldPalette,
} from './field-layout.ts';

/** What the painter needs to know about a play (or an edit) at one moment. */
export interface DrawState {
  readonly t: number;
  readonly rules: PlayRules;
  readonly isDone?: (i: number) => boolean;
  readonly isHeadDone?: (i: number) => boolean;
  readonly tracking?: (i: number) => boolean;
  readonly spin?: (i: number) => { readonly spins: number; readonly needed: number };
  /** The editor: everything near `t` shows, notes already passed faintly, nothing is judged. */
  readonly editor?: { readonly selected: ReadonlySet<string> };
}

/** How long a finished slider or spinner stays to fade out, in ms. */
const LINGER = 200;
const TAU = Math.PI * 2;
const SPINNER_RADIUS = 0.28;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Draws notes on the field: circles, approach rings, sliders, spinners and the dots between. */
export class FieldPainter {
  private readonly bodies = new WeakMap<PlayObject, Path2D>();
  private readonly longest = new WeakMap<readonly PlayObject[], number>();
  private readonly at = { x: 0, y: 0 };
  private readonly screen = { x: 0, y: 0 };

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    public palette: FieldPalette,
  ) {}

  draw(layout: FieldLayout, objects: readonly PlayObject[], s: DrawState): void {
    const { t } = s;
    const preempt = s.rules.preempt;
    const reach = this.longestOf(objects) + LINGER + 600;
    // Notes are sorted by time: find the last one that has appeared, then walk back.
    let hi = objects.length - 1;
    let lo = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if ((objects[mid] as PlayObject).t <= t + preempt) lo = mid + 1;
      else hi = mid - 1;
    }
    const last = hi;
    // Nothing has appeared yet (the count-in before the first note).
    if (last < 0) return;
    let first = last;
    while (first > 0 && (objects[first - 1] as PlayObject).t >= t - reach) first--;

    fieldTransform(this.ctx, layout);
    for (let i = first; i < last; i++) this.guide(objects[i] as PlayObject, objects[i + 1], s);
    for (let i = last; i >= first; i--) {
      const o = objects[i] as PlayObject;
      if (o.kind === 'spinner') this.spinner(layout, o, s);
      else if (o.kind === 'slider') this.slider(layout, o, s);
      else this.circleObject(layout, o, s);
    }
    screenTransform(this.ctx, layout);
  }

  private longestOf(objects: readonly PlayObject[]): number {
    let value = this.longest.get(objects);
    if (value === undefined) {
      value = objects.reduce((m, o) => Math.max(m, o.end - o.t), 0);
      this.longest.set(objects, value);
    }
    return value;
  }

  private colour(o: PlayObject): string {
    return o.comboIndex % 2 === 0 ? this.palette.accent : this.palette.ink;
  }

  /** Opacity as a note fades in, and (with Hidden) fades away again before it is due. */
  private fade(o: PlayObject, s: DrawState): number {
    const { preempt, fadeIn, hidden } = s.rules;
    const shown = s.t - (o.t - preempt);
    let alpha = clamp01(shown / fadeIn);
    if (s.editor) return s.t > o.end ? 0.35 : Math.max(alpha, 0.15);
    if (hidden) alpha *= clamp01((o.t - preempt * 0.3 - s.t) / (preempt * 0.3));
    return alpha;
  }

  private circleObject(layout: FieldLayout, o: PlayObject, s: DrawState): void {
    if (s.editor) {
      if (s.t > o.t + 400) return;
    } else if (s.isDone?.(o.index)) return;
    const alpha = this.fade(o, s);
    if (alpha <= 0) return;
    this.head(layout, o, s, alpha);
  }

  private head(layout: FieldLayout, o: PlayObject, s: DrawState, alpha: number): void {
    const ctx = this.ctx;
    const r = s.rules.radius;
    const colour = this.colour(o);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.palette.surface;
    ctx.beginPath();
    ctx.arc(o.x, o.y, r * 0.93, 0, TAU);
    ctx.fill();
    ctx.lineWidth = r * 0.14;
    ctx.strokeStyle = colour;
    ctx.stroke();
    if (s.editor?.selected.has(o.source.id)) {
      ctx.lineWidth = r * 0.08;
      ctx.strokeStyle = this.palette.accent;
      ctx.setLineDash([r * 0.25, r * 0.18]);
      ctx.beginPath();
      ctx.arc(o.x, o.y, r * 1.22, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if ((!s.rules.hidden || s.editor) && s.t < o.t) {
      const k = clamp01((o.t - s.t) / s.rules.preempt);
      ctx.lineWidth = r * 0.07;
      ctx.strokeStyle = colour;
      ctx.beginPath();
      ctx.arc(o.x, o.y, r * (1 + 2.2 * k), 0, TAU);
      ctx.stroke();
    }
    this.number(layout, o, r, alpha);
    ctx.globalAlpha = 1;
  }

  private number(layout: FieldLayout, o: PlayObject, r: number, alpha: number): void {
    const ctx = this.ctx;
    screenTransform(ctx, layout);
    toScreen(layout, o.x, o.y, this.screen);
    const px = Math.max(9, r * layout.scale * 0.85);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.palette.ink;
    ctx.font = `600 ${px}px ${this.palette.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(o.number), this.screen.x, this.screen.y + px * 0.04);
    fieldTransform(ctx, layout);
  }

  private body(o: PlayObject): Path2D | null {
    if (!o.path) return null;
    let path = this.bodies.get(o);
    if (!path) {
      path = new Path2D();
      const pts = o.path.points;
      const sx = o.source.kind === 'slider' ? o.x - o.source.x : 0;
      const sy = o.source.kind === 'slider' ? o.y - o.source.y : 0;
      path.moveTo((pts[0] ?? 0) + sx, (pts[1] ?? 0) + sy);
      for (let k = 2; k < pts.length; k += 2)
        path.lineTo((pts[k] ?? 0) + sx, (pts[k + 1] ?? 0) + sy);
      this.bodies.set(o, path);
    }
    return path;
  }

  private slider(layout: FieldLayout, o: PlayObject, s: DrawState): void {
    const ctx = this.ctx;
    const r = s.rules.radius;
    const { t } = s;
    if (s.editor ? t > o.end + 400 : t > o.end + LINGER) return;
    if (!s.editor && s.isDone?.(o.index) && t > o.end) return;
    let alpha = this.fade(o, s);
    if (!s.editor) {
      if (t > o.end) alpha = clamp01(1 - (t - o.end) / LINGER);
      // Hidden fades the body out as the ball travels it.
      if (s.rules.hidden && t > o.t) alpha *= clamp01(1 - (t - o.t) / Math.max(1, o.end - o.t));
    }
    if (alpha <= 0) return;
    const path = this.body(o);
    if (!path) return;
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = r * 1.96;
    ctx.strokeStyle = this.colour(o);
    ctx.stroke(path);
    ctx.lineWidth = r * 1.7;
    ctx.strokeStyle = this.palette.surface;
    ctx.stroke(path);
    ctx.strokeStyle = this.palette.line;
    ctx.stroke(path);

    ctx.fillStyle = this.palette.muted;
    let repeats = 0;
    for (const cp of o.checkpoints) {
      if (cp.t < t) continue;
      if (cp.kind === 'tick') {
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, r * 0.13, 0, TAU);
        ctx.fill();
      } else if (cp.kind === 'repeat' && repeats++ < 2) {
        this.arrow(cp.x, cp.y, o, r);
      }
    }

    const showHead = s.editor ? t <= o.t + 400 : !s.isHeadDone?.(o.index);
    if (showHead) this.head(layout, o, s, alpha);
    if (t >= o.t && t <= o.end) {
      ballAt(o, t, this.at);
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.palette.accent;
      ctx.beginPath();
      ctx.arc(this.at.x, this.at.y, r * 0.78, 0, TAU);
      ctx.fill();
      if (s.tracking?.(o.index)) {
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = r * 0.08;
        ctx.strokeStyle = this.palette.accent;
        ctx.beginPath();
        ctx.arc(this.at.x, this.at.y, r * 2.2, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** A chevron where the ball turns back. */
  private arrow(x: number, y: number, o: PlayObject, r: number): void {
    const pts = o.path?.points;
    if (!pts || pts.length < 4) return;
    const n = pts.length / 2;
    const sx = o.x - (o.source.kind === 'slider' ? o.source.x : o.x);
    const sy = o.y - (o.source.kind === 'slider' ? o.source.y : o.y);
    const atEnd = Math.hypot((pts[(n - 1) * 2] ?? 0) + sx - x, (pts[(n - 1) * 2 + 1] ?? 0) + sy - y) < 1e-4;
    const back = Math.min(n - 1, 6);
    const tx = atEnd ? (pts[(n - 1 - back) * 2] ?? 0) + sx : (pts[back * 2] ?? 0) + sx;
    const ty = atEnd ? (pts[(n - 1 - back) * 2 + 1] ?? 0) + sy : (pts[back * 2 + 1] ?? 0) + sy;
    const angle = Math.atan2(ty - y, tx - x);
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.lineWidth = r * 0.16;
    ctx.strokeStyle = this.palette.ink;
    ctx.beginPath();
    ctx.moveTo(-r * 0.25, -r * 0.4);
    ctx.lineTo(r * 0.3, 0);
    ctx.lineTo(-r * 0.25, r * 0.4);
    ctx.stroke();
    ctx.restore();
  }

  private spinner(layout: FieldLayout, o: PlayObject, s: DrawState): void {
    const ctx = this.ctx;
    const { t } = s;
    if (t < o.t - s.rules.preempt * 0.5 || t > o.end + (s.editor ? 400 : LINGER)) return;
    if (!s.editor && s.isDone?.(o.index)) return;
    const alpha = s.editor && t > o.end ? 0.35 : clamp01((t - (o.t - s.rules.preempt * 0.5)) / 200);
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 0.006;
    ctx.strokeStyle = this.palette.lineStrong;
    ctx.beginPath();
    ctx.arc(o.x, o.y, SPINNER_RADIUS, 0, TAU);
    ctx.stroke();
    const left = clamp01((o.end - Math.max(t, o.t)) / Math.max(1, o.end - o.t));
    ctx.strokeStyle = this.palette.ink;
    ctx.lineWidth = 0.004;
    ctx.beginPath();
    ctx.arc(o.x, o.y, Math.max(0.005, SPINNER_RADIUS * left), 0, TAU);
    ctx.stroke();
    const spin = s.spin?.(o.index);
    if (spin) {
      ctx.strokeStyle = this.palette.accent;
      ctx.lineWidth = 0.014;
      ctx.beginPath();
      const f = clamp01(spin.spins / spin.needed);
      ctx.arc(o.x, o.y, SPINNER_RADIUS + 0.02, -Math.PI / 2, -Math.PI / 2 + f * TAU);
      ctx.stroke();
      screenTransform(ctx, layout);
      toScreen(layout, o.x, o.y, this.screen);
      ctx.fillStyle = this.palette.ink;
      ctx.font = `600 ${Math.max(14, layout.scale * 0.05)}px ${this.palette.font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.floor(spin.spins)} / ${spin.needed}`, this.screen.x, this.screen.y);
      fieldTransform(ctx, layout);
    }
    ctx.fillStyle = this.palette.accent;
    ctx.beginPath();
    ctx.arc(o.x, o.y, 0.008, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /** Dots leading from one note to the next in its combo, as the next one approaches. */
  private guide(o: PlayObject, next: PlayObject | undefined, s: DrawState): void {
    if (!o.joined || !next || s.editor) return;
    const { t } = s;
    const start = next.t - s.rules.preempt;
    if (t < start || t > next.t) return;
    const dx = next.x - o.endX;
    const dy = next.y - o.endY;
    const d = Math.hypot(dx, dy);
    const r = s.rules.radius;
    if (d < r * 3) return;
    const ctx = this.ctx;
    ctx.fillStyle = this.palette.faint;
    const step = 0.03;
    const shownUntil = clamp01((t - start) / (s.rules.preempt * 0.5));
    const gone = clamp01((t - Math.max(o.end, start)) / Math.max(1, next.t - Math.max(o.end, start)));
    for (let k = r * 1.4; k < d - r * 1.4; k += step) {
      const f = k / d;
      if (f > shownUntil || f < gone) continue;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(o.endX + dx * f, o.endY + dy * f, 0.0035, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
