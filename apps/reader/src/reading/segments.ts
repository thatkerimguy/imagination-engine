import type { Block } from '@kn/core/guard';

/**
 * Splits a chapter into beat segments. Each segment ends on a `beatStop` block (inclusive) or
 * at the end of the chapter; the reader reveals one segment per tap-to-continue.
 */
export function segmentEnds(blocks: readonly Pick<Block, 'beatStop'>[]): number[] {
  const ends: number[] = [];
  blocks.forEach((b, i) => {
    if (b.beatStop && i < blocks.length - 1) ends.push(i);
  });
  ends.push(blocks.length - 1);
  return ends;
}

/** The segment index that contains block `index`. */
export function segmentOf(ends: readonly number[], index: number): number {
  const s = ends.findIndex((end) => index <= end);
  return s < 0 ? ends.length - 1 : s;
}
