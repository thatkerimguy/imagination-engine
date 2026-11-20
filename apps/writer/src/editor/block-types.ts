import type { Block } from '@kn/core';

export type ProseBlock = Extract<Block, { kind: 'prose' }>;
export type DialogueBlock = Extract<Block, { kind: 'dialogue' }>;
export type SceneBreakBlock = Extract<Block, { kind: 'scene-break' }>;
export type ModuleBlockT = Extract<Block, { kind: 'module' }>;

/** Props shared by the inline text editors for each block kind. */
export interface InlineEditorProps<B extends Block> {
  block: B;
  autoFocus: boolean;
  onChange(next: B): void;
  onSelect(): void;
}
