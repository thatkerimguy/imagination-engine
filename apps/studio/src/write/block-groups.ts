import { foldForSearch } from '@ie/i18n';
import type { MenuBlockType } from '../project/factory.ts';

/** The block picker's sections, in order. Every menu block is in exactly one (tested). */
export const BLOCK_GROUPS = {
  write: ['narration', 'dialogue', 'note', 'pause'],
  choices: ['choice', 'if', 'random', 'check', 'input', 'set'],
  flow: ['jump', 'call', 'return', 'exits', 'end'],
  game: ['fight', 'minigame', 'rhythm', 'item', 'quest', 'shop', 'battle', 'routine'],
  sound: ['music', 'sfx', 'ambience'],
  stage: [
    'background',
    'look',
    'effect',
    'burst',
    'title',
    'transition',
    'post',
    'param',
    'picture',
    'video',
    'sequence',
  ],
} as const satisfies Record<string, readonly MenuBlockType[]>;
export type BlockGroup = keyof typeof BLOCK_GROUPS;

export interface PickerEntry {
  readonly type: MenuBlockType;
  readonly group: BlockGroup;
  readonly label: string;
  readonly hint: string;
}

/**
 * Entries whose name, hint or type start a word with what was typed (case, accents and Turkish
 * dotted/dotless i don't matter). Name matches come before hint matches.
 */
export function filterEntries(entries: readonly PickerEntry[], query: string): PickerEntry[] {
  const q = foldForSearch(query.trim());
  if (!q) return [...entries];
  const words = (text: string) => foldForSearch(text).split(/[^\p{L}\p{N}]+/u);
  const starts = (text: string) => words(text).some((w) => w.startsWith(q));
  const byName = entries.filter((e) => starts(e.label) || e.type.startsWith(q));
  const byHint = entries.filter((e) => !byName.includes(e) && starts(e.hint));
  return [...byName, ...byHint];
}
