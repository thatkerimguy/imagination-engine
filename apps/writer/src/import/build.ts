// Turns parsed import items into writer blocks + per-block styles. Pure.
import type { SceneBreakBlock } from '@kn/core';
import type { NoteBlock } from '../store/folders.ts';
import { setBlockStyle, type BlockStyle, type ChapterStyles } from '../store/chapter-styles.ts';
import { newBlockId } from '../store/ids.ts';

export type ImportedItem =
  | { scene: true }
  | {
      scene?: false;
      text: string;
      style?: Pick<BlockStyle, 'align' | 'indent' | 'heading' | 'quote' | 'list'>;
    };

export interface ImportedDoc {
  title?: string;
  blocks: NoteBlock[];
  styles: ChapterStyles;
}

export function buildImported(
  title: string | undefined,
  items: readonly ImportedItem[],
): ImportedDoc {
  const blocks: NoteBlock[] = [];
  let styles: ChapterStyles = {};
  for (const item of items) {
    const id = newBlockId();
    if (item.scene) {
      blocks.push({ id, kind: 'scene-break' } satisfies SceneBreakBlock);
      continue;
    }
    if (!item.text.trim()) continue;
    blocks.push({ id, kind: 'prose', text: item.text });
    if (item.style) styles = setBlockStyle(styles, id, item.style);
  }
  return { ...(title ? { title } : {}), blocks, styles };
}

/** `* * *`, `---`, `***`, `___`, `# # #` and similar lines. */
export const isSceneBreakLine = (line: string): boolean =>
  /^\s*([*\-_#~=])(\s*\1){2,}\s*$/.test(line);

/** Normalises file text: no BOM, `\n` line endings, trimmed. */
export const cleanText = (raw: string): string =>
  (raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw).replace(/\r\n?/g, '\n').trim();
