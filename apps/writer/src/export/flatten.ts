// Flattens a chapter's blocks into simple printable items every serializer understands. Pure.
import type { Block } from '@kn/core';
import type { BlockStyle, ChapterStyles } from '../store/chapter-styles.ts';
import type { GimmickMode } from './book-model.ts';
import { gimmickLines, type InlineBlueprints } from './gimmick-text.ts';
import { escapeMarkup } from './markup-util.ts';

export interface ParaItem {
  type: 'p';
  /** Writer inline markup. */
  text: string;
  speaker?: string;
  heading?: 1 | 2 | 3;
  align?: NonNullable<BlockStyle['align']>;
  indent?: boolean;
  quote?: boolean;
  bullet?: boolean;
  italic?: boolean;
}

export interface BreakItem {
  type: 'break';
  label?: string;
}

export type Item = ParaItem | BreakItem;

/** Depth of a block heading: one level below the chapter title when it is shown. */
export const headingDepth = (h: 1 | 2 | 3, showTitle: boolean): number => (showTitle ? h + 1 : h);

function layout(style: BlockStyle | undefined): Partial<ParaItem> {
  if (!style) return {};
  return {
    ...(style.heading ? { heading: style.heading } : {}),
    ...(style.align ? { align: style.align } : {}),
    ...(style.indent ? { indent: true } : {}),
    ...(style.quote ? { quote: true } : {}),
    ...(style.list ? { bullet: true } : {}),
  };
}

export function flattenBlocks(
  blocks: readonly Block[],
  styles: ChapterStyles,
  mode: GimmickMode,
  inline?: InlineBlueprints,
): Item[] {
  const out: Item[] = [];
  for (const b of blocks) {
    const style = styles[b.id];
    if (b.kind === 'prose') {
      const italic = b.style === 'whisper' || b.style === 'emphasis';
      out.push({
        type: 'p',
        text: style?.raw ?? b.text,
        ...layout(style),
        ...(italic ? { italic } : {}),
      });
    } else if (b.kind === 'dialogue') {
      out.push({ type: 'p', speaker: b.speaker, text: style?.raw ?? b.text, ...layout(style) });
    } else if (b.kind === 'scene-break') {
      out.push({ type: 'break', ...(b.label?.trim() ? { label: b.label.trim() } : {}) });
    } else {
      for (const line of gimmickLines(b, mode, inline)) {
        out.push({
          type: 'p',
          text: escapeMarkup(line.text),
          ...(line.speaker ? { speaker: line.speaker } : {}),
          ...(line.italic ? { italic: true } : {}),
        });
      }
    }
  }
  return out;
}
