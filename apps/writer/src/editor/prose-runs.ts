// Continuous prose runs: adjacent plain `prose` blocks edit as ONE text surface (paragraphs joined
// by a blank line), interleaved with atomic dialogue / scene-break / cue segments. Pure and
// lossless both ways: `segmentsToBlocks(blocksToSegments(b), b)` returns `b` unchanged.
import type { Block } from '@kn/core';
import { newBlockId } from '../store/ids.ts';
import type { ProseBlock } from './block-types.ts';

/** Paragraph separator inside a prose run. */
export const PARA = '\n\n';

export type EditorSegment =
  | {
      kind: 'prose-run';
      id: string;
      blockIds: string[];
      markdown: string;
      /** One standalone block: its text is replaced whole, never split into paragraphs. */
      single?: boolean;
    }
  | { kind: 'dialogue' | 'scene-break' | 'cue'; id: string; block: Block };

export interface SegmentOptions {
  /** `false` hides cue (module) blocks; they are kept in place on the way back. */
  includeCues: boolean;
  /** Prose blocks that must stay their own run (block styles, beat stops…). */
  standalone?(block: ProseBlock): boolean;
}

const isPlainProse = (b: Block, o: SegmentOptions): b is ProseBlock =>
  b.kind === 'prose' && !b.text.includes(PARA) && !o.standalone?.(b);

/** A non-mergeable block: prose becomes a one-block run that is never split on `PARA`. */
function atomic(b: Block): EditorSegment {
  if (b.kind === 'prose')
    return { kind: 'prose-run', id: b.id, blockIds: [b.id], markdown: b.text, single: true };
  return { kind: b.kind === 'module' ? 'cue' : b.kind, id: b.id, block: b };
}

/** Groups blocks into segments. Hidden cues are skipped (runs flow over them) and restored later. */
export function blocksToSegments(blocks: readonly Block[], o: SegmentOptions): EditorSegment[] {
  const out: EditorSegment[] = [];
  let run: ProseBlock[] = [];
  const flush = (): void => {
    if (run.length)
      out.push({
        kind: 'prose-run',
        id: run[0]!.id,
        blockIds: run.map((b) => b.id),
        markdown: run.map((b) => b.text).join(PARA),
      });
    run = [];
  };
  for (const b of blocks) {
    if (isPlainProse(b, o)) {
      run.push(b);
      // A beat stop pauses after its block, so it also ends the run there.
      if (b.beatStop) flush();
      continue;
    }
    // A hidden cue does not interrupt the prose around it: it is re-anchored on the way back.
    if (b.kind === 'module' && !o.includeCues) continue;
    flush();
    out.push(atomic(b));
  }
  flush();
  return out;
}

/**
 * Prose blocks for edited run text. Ids are kept where paragraphs still line up: unchanged
 * leading and trailing paragraphs keep theirs, the middle reuses the rest in order, and only
 * surplus paragraphs get new ids. Reused blocks keep every other field (style, beat stop…).
 */
export function runToBlocks(
  markdown: string,
  previous: readonly ProseBlock[],
  newId: () => string = newBlockId,
): ProseBlock[] {
  const paras = markdown.split(PARA);
  const n = paras.length;
  const m = previous.length;
  const ids: (ProseBlock | undefined)[] = new Array<ProseBlock | undefined>(n);
  let head = 0;
  while (head < n && head < m && paras[head] === previous[head]!.text) {
    ids[head] = previous[head];
    head++;
  }
  let tail = 0;
  while (
    tail < n - head &&
    tail < m - head &&
    paras[n - 1 - tail] === previous[m - 1 - tail]!.text
  ) {
    ids[n - 1 - tail] = previous[m - 1 - tail];
    tail++;
  }
  const spare = previous.slice(head, m - tail);
  for (let i = head; i < n - tail; i++) ids[i] = spare.shift();
  return paras.map((text, i) => {
    const prev = ids[i];
    return prev
      ? prev.text === text
        ? prev
        : { ...prev, text }
      : { id: newId(), kind: 'prose', text };
  });
}

/** Rebuilds the chapter's blocks from segments, re-inserting cues the segments do not show. */
export function segmentsToBlocks(
  segments: readonly EditorSegment[],
  originalBlocks: readonly Block[],
  newId: () => string = newBlockId,
): Block[] {
  const byId = new Map(originalBlocks.map((b) => [b.id, b]));
  const visible: Block[] = [];
  for (const s of segments) {
    if (s.kind !== 'prose-run') {
      visible.push(s.block);
      continue;
    }
    const prev = s.blockIds
      .map((id) => byId.get(id))
      .filter((b): b is ProseBlock => b?.kind === 'prose');
    if (s.single && prev[0]) visible.push({ ...prev[0], text: s.markdown });
    else visible.push(...runToBlocks(s.markdown, prev, newId));
  }
  return restoreHidden(visible, originalBlocks);
}

/** Puts back original blocks missing from `visible` (hidden cues) after their nearest anchor. */
function restoreHidden(visible: Block[], original: readonly Block[]): Block[] {
  const shown = new Set(visible.map((b) => b.id));
  const hidden = original.filter((b) => b.kind === 'module' && !shown.has(b.id));
  if (!hidden.length) return visible;
  const out = [...visible];
  for (const cue of hidden) {
    const at = original.indexOf(cue);
    let anchor = -1;
    for (let i = at - 1; i >= 0 && anchor < 0; i--)
      anchor = out.findIndex((b) => b.id === original[i]!.id);
    // Paragraphs newly typed at the end of the anchor's run belong before the cue.
    const known = new Set(original.map((b) => b.id));
    while (anchor >= 0 && anchor + 1 < out.length && !known.has(out[anchor + 1]!.id)) anchor++;
    out.splice(anchor + 1, 0, cue);
  }
  return out;
}

/** The chapter's blocks with one run replaced by edited text (everything else untouched). */
export function applyRunEdit(
  blocks: readonly Block[],
  run: Pick<Extract<EditorSegment, { kind: 'prose-run' }>, 'blockIds' | 'single'>,
  markdown: string,
  newId: () => string = newBlockId,
): Block[] {
  const ids = new Set(run.blockIds);
  const first = blocks.findIndex((b) => ids.has(b.id));
  if (first < 0) return [...blocks];
  const last = blocks.findLastIndex((b) => ids.has(b.id));
  const prev = blocks.filter((b): b is ProseBlock => ids.has(b.id) && b.kind === 'prose');
  // Cues hidden inside the run's span are lifted out, then re-anchored after their paragraph.
  const inside = new Set(blocks.slice(first, last + 1).map((b) => b.id));
  const rest = blocks.filter((b) => !inside.has(b.id));
  const next =
    run.single && prev[0] ? [{ ...prev[0], text: markdown }] : runToBlocks(markdown, prev, newId);
  return restoreHidden([...rest.slice(0, first), ...next, ...rest.slice(first)], blocks);
}

/** Where each paragraph of a run starts in its text. */
export function paragraphStarts(markdown: string): number[] {
  const starts = [0];
  for (let at = markdown.indexOf(PARA); at >= 0; at = markdown.indexOf(PARA, at + PARA.length))
    starts.push(at + PARA.length);
  return starts;
}

/** A run offset → (paragraph index, offset inside it). Offsets in a separator snap forward. */
export function locateInRun(markdown: string, offset: number): { index: number; local: number } {
  const starts = paragraphStarts(markdown);
  let index = 0;
  while (index + 1 < starts.length && starts[index + 1]! - PARA.length < offset) index++;
  const local = Math.max(0, offset - starts[index]!);
  return { index, local };
}
