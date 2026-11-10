import type { Block, BlockType } from '@ie/story';
import { audioKind, type AudioKind } from '../project/factory.ts';
import { stageKind, type StageKind } from '../project/stage-kinds.ts';
import {
  AlignLeft,
  Blend,
  CloudRain,
  Heading,
  Film,
  Sparkles,
  SunDim,
  Vibrate,
  CornerDownRight,
  Dices,
  Flag,
  GitBranch,
  Hourglass,
  ListChecks,
  Music,
  MessageSquare,
  Package,
  ScrollText,
  Shield,
  Store,
  Repeat,
  Phone,
  Shuffle,
  SquarePen,
  StickyNote,
  Swords,
  TextCursorInput,
  Undo2,
  Volume2,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { MessageKey } from '../messages.ts';

export type BlockKind = BlockType | AudioKind | StageKind;

export const BLOCK_ICON: Readonly<Record<BlockKind, LucideIcon>> = {
  background: CloudRain,
  look: SunDim,
  effect: Vibrate,
  burst: Sparkles,
  title: Heading,
  transition: Blend,
  sequence: Film,
  music: Music,
  sfx: Volume2,
  ambience: Wind,
  narration: AlignLeft,
  dialogue: MessageSquare,
  choice: ListChecks,
  if: GitBranch,
  check: Dices,
  fight: Swords,
  item: Package,
  quest: ScrollText,
  shop: Store,
  battle: Shield,
  routine: Repeat,
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

export const blockName = (type: BlockKind): MessageKey => `block.${type}`;
export const blockHint = (type: BlockKind): MessageKey => `blockHint.${type}`;

/** What the author sees a block as: its type, or its audio or stage kind for those actions. */
export function blockKind(block: Block): BlockKind {
  return audioKind(block) ?? stageKind(block) ?? block.type;
}
