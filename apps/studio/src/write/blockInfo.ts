import type { BlockType } from '@ie/story';
import {
  AlignLeft,
  CornerDownRight,
  Dices,
  Flag,
  GitBranch,
  Hourglass,
  ListChecks,
  MessageSquare,
  Phone,
  Shuffle,
  SquarePen,
  StickyNote,
  TextCursorInput,
  Undo2,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { MessageKey } from '../messages.ts';

export const BLOCK_ICON: Readonly<Record<BlockType, LucideIcon>> = {
  narration: AlignLeft,
  dialogue: MessageSquare,
  choice: ListChecks,
  if: GitBranch,
  check: Dices,
  input: TextCursorInput,
  pause: Hourglass,
  note: StickyNote,
  set: SquarePen,
  jump: CornerDownRight,
  call: Phone,
  return: Undo2,
  random: Shuffle,
  end: Flag,
  action: Zap,
};

export const blockName = (type: BlockType): MessageKey => `block.${type}`;
export const blockHint = (type: BlockType): MessageKey => `blockHint.${type}`;
