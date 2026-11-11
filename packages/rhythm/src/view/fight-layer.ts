import type { Rgb, StageLayer, StagePen } from '@ie/stage';
import type { NoteKind } from '../director.ts';
import type { LiveNote } from '../fight.ts';

export interface FightColors {
  readonly strike: Rgb;
  readonly parry: Rgb;
  readonly dodge: Rgb;
  readonly miss: Rgb;
}

/**
 * The glyph inside each note's mark. It says what to do, not only what happens: the two tap notes
 * are solid shapes, the swipe note is a two-way arrow (and gets a double ring), so colour is never
 * the only difference.
 */
export const NOTE_GLYPHS: Readonly<Record<NoteKind, string>> = {
  strike: '●',
  parry: '■',
  dodge: '↔',
};

/** Which input a note wants. */
export const NOTE_INPUT: Readonly<Record<NoteKind, 'tap' | 'swipe'>> = {
  strike: 'tap',
  parry: 'tap',
  dodge: 'swipe',
};

/** How long a judged note's flash lasts, and how long a slash stays. */
const HIT_FADE = 0.28;
const SLASH_FADE = 0.22;

interface Effect {
  readonly kind: 'slash' | 'pulse';
  readonly x: number;
  readonly y: number;
  readonly at: number;
  readonly angle: number;
  readonly rgb: Rgb;
}

export interface FightLayerOptions {
  /** Heard time of the music, in seconds. */
  readonly now: () => number;
  readonly notes: () => readonly LiveNote[];
  /** Seconds a note is shown before it lands. */
  readonly approach: number;
  readonly colors: () => FightColors;
  /** The fight's own per-frame work, run before drawing. */
  readonly onFrame: () => void;
  /** Seconds either side of a note that still count (the "good" window, wider with the assist). */
  readonly hitWindow: number;
}

/**
 * Draws a fight's notes on the stage: each one is a mark with its glyph and an approach ring that
 * shrinks onto it exactly when the note lands. Judged notes flash and fade; strikes leave slashes.
 */
export class FightLayer implements StageLayer {
  readonly glyphs = Object.values(NOTE_GLYPHS).join('');
  private effects: Effect[] = [];
  private judgedAt = new Map<string, number>();
  private first = 0;
  private finished = false;

  constructor(private readonly options: FightLayerOptions) {}

  /** A note was just judged at heard time `time`. */
  judged(note: LiveNote, time: number, width: number, height: number): void {
    this.judgedAt.set(note.id, time);
    if (note.grade === 'miss') return;
    const x = note.x * width;
    const y = note.y * height;
    const rgb = this.options.colors()[note.kind];
    this.effects.push({ kind: 'pulse', x, y, at: time, angle: 0, rgb });
    if (note.kind === 'strike')
      this.effects.push({
        kind: 'slash',
        x,
        y,
        at: time,
        angle: -0.6 + Math.random() * 1.2 - Math.PI / 4,
        rgb,
      });
  }

  /** A strike placed freely on the grid landed; slash across the middle of the stage. */
  freeStrike(time: number, width: number, height: number): void {
    const rgb = this.options.colors().strike;
    const x = width * (0.3 + Math.random() * 0.4);
    const y = height * (0.55 + Math.random() * 0.15);
    this.effects.push({
      kind: 'slash',
      x,
      y,
      at: time,
      angle: -Math.PI / 4 + (Math.random() - 0.5),
      rgb,
    });
  }

  finish(): void {
    this.finished = true;
  }

  draw(pen: StagePen, _time: number): boolean {
    this.options.onFrame();
    if (this.finished) return false;
    const now = this.options.now();
    const colors = this.options.colors();
    const { approach } = this.options;
    const notes = this.options.notes();
    // Big enough to read on a phone at arm's length: about a fingertip across the target ring.
    const unit = Math.max(28, Math.min(52, Math.min(pen.width, pen.height) * 0.085));
    while (this.first < notes.length && (notes[this.first]?.time ?? 0) < now - HIT_FADE - 0.2)
      this.first++;
    for (let i = this.first; i < notes.length; i++) {
      const note = notes[i];
      if (!note) continue;
      const until = note.time - now;
      if (until > approach) break;
      this.drawNote(pen, note, until, now, unit, colors);
    }
    this.effects = this.effects.filter((e) => now - e.at < Math.max(HIT_FADE, SLASH_FADE));
    for (const e of this.effects) {
      const age = now - e.at;
      if (e.kind === 'pulse') {
        const k = age / HIT_FADE;
        pen.ring(e.x, e.y, unit * (1 + k * 0.9), 3 * (1 - k) + 1, e.rgb, 1 - k);
      } else {
        const k = age / SLASH_FADE;
        pen.slash(
          e.x,
          e.y,
          Math.min(pen.width, pen.height) * 0.5,
          7 * (1 - k) + 1,
          e.angle,
          e.rgb,
          1 - k,
        );
      }
    }
    return true;
  }

  private drawNote(
    pen: StagePen,
    note: LiveNote,
    until: number,
    now: number,
    unit: number,
    colors: FightColors,
  ): void {
    const x = note.x * pen.width;
    const y = note.y * pen.height;
    const glyph = NOTE_GLYPHS[note.kind];
    if (note.grade) {
      const at = this.judgedAt.get(note.id) ?? note.time;
      const k = Math.min(1, (now - at) / HIT_FADE);
      if (k >= 1) return;
      const rgb = note.grade === 'miss' ? colors.miss : colors[note.kind];
      pen.glyph(glyph, x, y, unit * (1.1 + (note.grade === 'miss' ? 0 : k * 0.6)), rgb, 1 - k);
      return;
    }
    const p = Math.max(0, until / this.options.approach); // 1 when it appears, 0 when it lands
    const rgb = colors[note.kind];
    const fadeIn = Math.min(1, (1 - p) * 4);
    // Inside the window that still scores, the target ring thickens: "now" is visible, not guessed.
    const now_ = Math.abs(until) <= this.options.hitWindow;
    const target = now_ ? 5 : 2.5;
    pen.ring(x, y, unit, target, rgb, now_ ? 1 : 0.5 * fadeIn + 0.4 * (1 - p));
    if (NOTE_INPUT[note.kind] === 'swipe')
      pen.ring(x, y, unit * 0.78, target * 0.6, rgb, now_ ? 1 : 0.4 * fadeIn + 0.4 * (1 - p));
    pen.ring(x, y, unit * (1 + 2.2 * p), 3, rgb, fadeIn * (0.4 + 0.6 * (1 - p)));
    pen.glyph(glyph, x, y, unit * (NOTE_INPUT[note.kind] === 'swipe' ? 1.15 : 0.9), rgb, fadeIn);
  }
}
