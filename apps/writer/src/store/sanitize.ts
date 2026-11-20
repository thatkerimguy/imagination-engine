// Drafts may hold half-written blocks (an empty prose line, a dialogue with no speaker yet).
// Those stay in the editor but are never persisted or previewed, so every stored chapter passes
// @kn/core's validator.
import { parseChapterDocument, type Block, type ChapterDocument } from '@kn/core';

const HEX = /^#[0-9a-fA-F]{6}$/;
const filled = (s: string | undefined): s is string => s !== undefined && s.trim() !== '';

/** A block is complete when every required text field has content. */
export function isBlockComplete(block: Block): boolean {
  if (block.kind === 'prose') return filled(block.text);
  if (block.kind === 'dialogue') return filled(block.speaker) && filled(block.text);
  return true;
}

/** Drops empty optional fields and invalid half-typed colours. */
export function cleanBlock(block: Block): Block {
  switch (block.kind) {
    case 'prose': {
      const { style, ...rest } = block;
      return style && style !== 'body' ? { ...rest, style } : rest;
    }
    case 'dialogue': {
      const { accentColor, ...rest } = block;
      return accentColor && HEX.test(accentColor) ? { ...rest, accentColor } : rest;
    }
    case 'scene-break': {
      const { label, timestamp, ...rest } = block;
      return {
        ...rest,
        ...(filled(label) ? { label } : {}),
        ...(filled(timestamp) ? { timestamp } : {}),
      };
    }
    case 'module':
      return block;
  }
}

export interface PreparedChapter {
  chapter: ChapterDocument;
  /** Ids of unfinished blocks that were left out. */
  skipped: string[];
}

export type PrepareResult = ({ ok: true } & PreparedChapter) | { ok: false; errors: string[] };

/** Cleans the draft, leaves out unfinished blocks, then validates with @kn/core. */
export function prepareChapter(draft: ChapterDocument): PrepareResult {
  const skipped = draft.blocks.filter((b) => !isBlockComplete(b)).map((b) => b.id);
  const blocks = draft.blocks.filter(isBlockComplete).map(cleanBlock);
  const parsed = parseChapterDocument({ ...draft, blocks });
  return parsed.ok ? { ok: true, chapter: parsed.value, skipped } : parsed;
}
