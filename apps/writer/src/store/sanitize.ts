// Drafts may hold half-written blocks (an empty prose line, a dialogue with no speaker yet).
// Those stay in the editor but are never persisted or previewed, so every stored chapter passes
// @kn/core's validator.
// Writer-only inline markup ({fg}, {bg}, {{comment}}) is stripped here too; the Author's source
// text survives in the chapter-styles sidecar (see chapter-styles.ts).
import { parseChapterDocument, type Block, type ChapterDocument } from '@kn/core';
import { starterResolver, type BlueprintResolver } from './blueprint-resolver.ts';
import { sanitizeForReader, stripInlineMarkup } from '../editor/inline-markup.ts';

const HEX = /^#[0-9a-fA-F]{6}$/;
const filled = (s: string | undefined): s is string => s !== undefined && s.trim() !== '';
/** Text that still reads as something once every delimiter and comment is removed. */
const hasWords = (s: string | undefined): s is string => filled(s) && filled(stripInlineMarkup(s));

/** A block is complete when every required text field has content. */
export function isBlockComplete(block: Block): boolean {
  if (block.kind === 'prose') return hasWords(block.text);
  if (block.kind === 'dialogue') return filled(block.speaker) && hasWords(block.text);
  return true;
}

/** Drops empty optional fields and invalid half-typed colours. */
export function cleanBlock(block: Block): Block {
  switch (block.kind) {
    case 'prose': {
      const { style, ...rest } = block;
      const text = sanitizeForReader(block.text);
      return style && style !== 'body' ? { ...rest, text, style } : { ...rest, text };
    }
    case 'dialogue': {
      const { accentColor, ...rest } = block;
      const text = sanitizeForReader(block.text);
      return accentColor && HEX.test(accentColor)
        ? { ...rest, text, accentColor }
        : { ...rest, text };
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

/**
 * The chapter's inline v2 blueprints: exactly the ones its cues use, so a published chapter is
 * self-contained (the reader never ships a 1,000-blueprint bundle). Blueprints already carried
 * by the draft (imported books, installed packs) win over the bundled starter copy.
 */
export function inlineBlueprints(
  blocks: readonly Block[],
  carried: ChapterDocument['blueprints'] = {},
  resolve: BlueprintResolver = starterResolver,
): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const b of blocks) {
    if (b.kind !== 'module' || typeof b.props.blueprintId !== 'string') continue;
    const id = b.props.blueprintId;
    const bp = carried[id] ?? resolve(id);
    if (bp) out[id] = bp;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Cleans the draft, leaves out unfinished blocks, inlines every cue's blueprint (via `resolve`:
 * catalog first, starters as fallback; default starters only), then validates with @kn/core.
 */
export function prepareChapter(
  draft: ChapterDocument,
  resolve: BlueprintResolver = starterResolver,
): PrepareResult {
  const skipped = draft.blocks.filter((b) => !isBlockComplete(b)).map((b) => b.id);
  const blocks = draft.blocks.filter(isBlockComplete).map(cleanBlock);
  const { blueprints: carried, ...rest } = draft;
  const blueprints = inlineBlueprints(blocks, carried, resolve);
  const parsed = parseChapterDocument({ ...rest, blocks, ...(blueprints ? { blueprints } : {}) });
  return parsed.ok ? { ok: true, chapter: parsed.value, skipped } : parsed;
}
