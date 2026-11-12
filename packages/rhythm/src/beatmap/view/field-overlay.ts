import type { Judgement, PlayRules } from '../rules.ts';
import { toScreen, type FieldLayout, type FieldPalette } from './field-layout.ts';

interface Popup {
  x: number;
  y: number;
  at: number;
  text: string;
  judgement: Judgement | 'part';
}

const POPUP_MS = 480;
const ERROR_MS = 4000;
const TRAIL = 8;
const TAU = Math.PI * 2;

/**
 * What sits over the notes, in CSS pixels: judgement words where notes were hit, the cursor and
 * its short trail, and the timing bar that shows how early or late each tap was.
 */
export class FieldOverlay {
  private popups: Popup[] = [];
  private readonly offsets: { offset: number; at: number }[] = [];
  private readonly trail: { x: number; y: number }[] = [];
  private readonly screen = { x: 0, y: 0 };

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    public palette: FieldPalette,
  ) {}

  /** `text` is empty for judgements that show only a burst (perfect hits stay quiet). */
  judged(x: number, y: number, judgement: Judgement | 'part', text: string, now: number): void {
    this.popups.push({ x, y, at: now, text, judgement });
    if (this.popups.length > 40) this.popups.shift();
  }

  tapped(offset: number, now: number): void {
    this.offsets.push({ offset, at: now });
    if (this.offsets.length > 40) this.offsets.shift();
  }

  clear(): void {
    this.popups = [];
    this.offsets.length = 0;
    this.trail.length = 0;
  }

  drawPopups(layout: FieldLayout, radius: number, now: number): void {
    const ctx = this.ctx;
    this.popups = this.popups.filter((p) => now - p.at < POPUP_MS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of this.popups) {
      const k = (now - p.at) / POPUP_MS;
      toScreen(layout, p.x, p.y, this.screen);
      const r = radius * layout.scale;
      if (p.judgement === 'part') continue;
      if (p.judgement !== 'miss') {
        ctx.globalAlpha = (1 - k) * 0.6;
        ctx.strokeStyle = this.palette.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.screen.x, this.screen.y, r * (1 + k * 0.5), 0, TAU);
        ctx.stroke();
      }
      if (p.text) {
        ctx.globalAlpha = 1 - k * k;
        ctx.fillStyle = p.judgement === 'miss' ? this.palette.muted : this.palette.ink;
        ctx.font = `600 ${Math.max(12, r * 0.6)}px ${this.palette.font}`;
        ctx.fillText(p.text, this.screen.x, this.screen.y - r * 0.3 - k * r * 0.4);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** The cursor where the mouse (or auto) aims. Touch plays without one. */
  drawCursor(layout: FieldLayout, x: number, y: number): void {
    const ctx = this.ctx;
    toScreen(layout, x, y, this.screen);
    this.trail.push({ x: this.screen.x, y: this.screen.y });
    if (this.trail.length > TRAIL) this.trail.shift();
    ctx.fillStyle = this.palette.ink;
    for (let i = 0; i < this.trail.length - 1; i++) {
      const p = this.trail[i] as { x: number; y: number };
      ctx.globalAlpha = ((i + 1) / this.trail.length) * 0.25;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.palette.ink;
    ctx.beginPath();
    ctx.arc(this.screen.x, this.screen.y, 7, 0, TAU);
    ctx.stroke();
  }

  /** The timing bar: perfect, great and good bands, a line per recent tap, the average beneath. */
  drawErrorBar(layout: FieldLayout, rules: PlayRules, now: number, bottom: number): void {
    const ctx = this.ctx;
    const half = Math.min(130, layout.width * 0.28);
    const cx = layout.width / 2;
    const y = layout.height - bottom;
    const px = half / rules.windows.good;
    const band = (ms: number, colour: string, h: number) => {
      ctx.fillStyle = colour;
      ctx.fillRect(cx - ms * px, y - h / 2, ms * 2 * px, h);
    };
    ctx.globalAlpha = 1;
    band(rules.windows.good, this.palette.line, 4);
    band(rules.windows.great, this.palette.lineStrong, 4);
    ctx.globalAlpha = 0.5;
    band(rules.windows.perfect, this.palette.accent, 4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.palette.ink;
    ctx.fillRect(cx - 1, y - 8, 2, 16);
    let sum = 0;
    let count = 0;
    for (const hit of this.offsets) {
      const age = now - hit.at;
      if (age > ERROR_MS) continue;
      const offset = Math.max(-rules.windows.good, Math.min(rules.windows.good, hit.offset));
      ctx.globalAlpha = 1 - age / ERROR_MS;
      ctx.fillStyle = this.palette.ink;
      ctx.fillRect(cx + offset * px - 1, y - 7, 2, 14);
      sum += hit.offset;
      count++;
    }
    if (count > 0) {
      const mean = Math.max(-rules.windows.good, Math.min(rules.windows.good, sum / count));
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.palette.accent;
      ctx.beginPath();
      ctx.moveTo(cx + mean * px, y + 9);
      ctx.lineTo(cx + mean * px - 5, y + 15);
      ctx.lineTo(cx + mean * px + 5, y + 15);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
