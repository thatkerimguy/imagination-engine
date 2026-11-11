import type { Block, StoryProject } from '@ie/story';
import { walkBlocks } from '../project/tree.ts';

/**
 * Who answers when the author presses Enter after a dialogue line: the other side of the
 * conversation, found by looking back past narration to the previous dialogue line. Null when
 * there is no one else in the exchange, and the next line is narration as usual.
 */
export function replyingSpeaker(list: readonly Block[], index: number): string | null {
  const current = list[index];
  if (current?.type !== 'dialogue') return null;
  for (let i = index - 1; i >= 0; i--) {
    const block = list[i];
    if (block?.type === 'narration') continue;
    if (block?.type !== 'dialogue') return null;
    return block.speaker && block.speaker !== current.speaker ? block.speaker : null;
  }
  return null;
}

/** The blocks of one list, by its key. */
export function listBlocks(project: StoryProject, listKey: string): Block[] {
  const blocks: Block[] = [];
  walkBlocks(project, (place) => {
    if (place.listKey === listKey) blocks[place.index] = place.block;
  });
  return blocks;
}
