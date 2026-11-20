// Pure, immutable block operations used by the chapter editor. Every function returns a new
// chapter (or the same object when nothing changed) so React state stays predictable.
import type { Block, ChapterDocument, ModuleBlock } from '@kn/core';
import { newBlockId } from './ids.ts';

export type InsertableKind = 'prose' | 'dialogue' | 'scene-break';

export function createBlock(kind: InsertableKind): Block {
  const id = newBlockId();
  switch (kind) {
    case 'prose':
      return { id, kind: 'prose', text: '' };
    case 'dialogue':
      return { id, kind: 'dialogue', speaker: '', text: '' };
    case 'scene-break':
      return { id, kind: 'scene-break' };
  }
}

export function createModuleBlock(
  moduleId: string,
  moduleVersion: number,
  props: Record<string, unknown>,
): ModuleBlock {
  return { id: newBlockId(), kind: 'module', moduleId, moduleVersion, props: { ...props } };
}

/** Inserts after `afterId`; `null` (or an unknown id) appends at the end. */
export function insertBlock(
  chapter: ChapterDocument,
  block: Block,
  afterId: string | null,
): ChapterDocument {
  const blocks = [...chapter.blocks];
  const at = afterId === null ? -1 : blocks.findIndex((b) => b.id === afterId);
  blocks.splice(at === -1 ? blocks.length : at + 1, 0, block);
  return { ...chapter, blocks };
}

/** Replaces the block with the same id. */
export function replaceBlock(chapter: ChapterDocument, block: Block): ChapterDocument {
  const i = chapter.blocks.findIndex((b) => b.id === block.id);
  if (i === -1) return chapter;
  const blocks = [...chapter.blocks];
  blocks[i] = block;
  return { ...chapter, blocks };
}

export function moveBlock(chapter: ChapterDocument, id: string, delta: -1 | 1): ChapterDocument {
  const i = chapter.blocks.findIndex((b) => b.id === id);
  const j = i + delta;
  if (i === -1 || j < 0 || j >= chapter.blocks.length) return chapter;
  const blocks = [...chapter.blocks];
  [blocks[i], blocks[j]] = [blocks[j]!, blocks[i]!];
  return { ...chapter, blocks };
}

export function removeBlock(chapter: ChapterDocument, id: string): ChapterDocument {
  const blocks = chapter.blocks.filter((b) => b.id !== id);
  return blocks.length === chapter.blocks.length ? chapter : { ...chapter, blocks };
}

export function toggleBeatStop(chapter: ChapterDocument, id: string): ChapterDocument {
  const block = chapter.blocks.find((b) => b.id === id);
  if (!block) return chapter;
  const { beatStop, ...rest } = block;
  return replaceBlock(chapter, beatStop ? (rest as Block) : { ...block, beatStop: true });
}
