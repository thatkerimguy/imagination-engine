import type { SequenceCue } from './compile.ts';

/** Backward steps up to this many beats are jitter, not a seek. */
const JITTER_BEATS = 0.25;

/** First index whose cue is at or after `beat` (cues are sorted). */
function firstAtOrAfter(cues: readonly SequenceCue[], beat: number): number {
  let lo = 0;
  let hi = cues.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((cues[mid]?.beat ?? 0) < beat) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Walks a compiled sequence's cues as the clock passes them. Each frame is an index and a loop:
 * no allocation, so it can run every frame on the phone (PLAN §11.1).
 */
export class SequenceCursor {
  private index = 0;
  private last = Number.NEGATIVE_INFINITY;

  constructor(private readonly cues: readonly SequenceCue[]) {}

  /** True once every cue has fired. */
  get done(): boolean {
    return this.index >= this.cues.length;
  }

  /**
   * Fires every cue up to and including `beat`. A real jump back seeks instead of firing; a small
   * step back is clock jitter (the conductor eases towards each position report, which can pull it
   * back a few milliseconds) and is held, so cues just passed don't fire twice.
   */
  advance(beat: number, fire: (cue: SequenceCue) => void): void {
    if (beat < this.last) {
      if (this.last - beat > JITTER_BEATS) this.seek(beat);
      return;
    }
    const cues = this.cues;
    while (this.index < cues.length) {
      const cue = cues[this.index];
      if (!cue || cue.beat > beat) break;
      this.index++;
      fire(cue);
    }
    this.last = beat;
  }

  /** Moves to `beat` without firing anything; a cue exactly at `beat` fires on the next advance. */
  seek(beat: number): void {
    this.index = firstAtOrAfter(this.cues, beat);
    this.last = beat;
  }
}

/**
 * Cues that arrive while something plays, such as the choreography of each move a fight picks.
 * Adding sorts (that happens a few times a bar); advancing is a loop like the cursor's.
 */
export class CueQueue {
  private items: SequenceCue[] = [];
  private head = 0;

  get size(): number {
    return this.items.length - this.head;
  }

  /** Queues `cues` shifted by `offset` beats. */
  add(cues: readonly SequenceCue[], offset: number): void {
    if (cues.length === 0) return;
    if (this.head > 0) {
      this.items.splice(0, this.head);
      this.head = 0;
    }
    for (const cue of cues) this.items.push({ ...cue, beat: cue.beat + offset });
    this.items.sort((a, b) => a.beat - b.beat);
  }

  advance(beat: number, fire: (cue: SequenceCue) => void): void {
    const items = this.items;
    while (this.head < items.length) {
      const cue = items[this.head];
      if (!cue || cue.beat > beat) break;
      this.head++;
      fire(cue);
    }
  }

  clear(): void {
    this.items = [];
    this.head = 0;
  }
}
