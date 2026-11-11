import type { Block, BlockType } from '@ie/story';
import { audioKind, type AudioKind } from '../project/factory.ts';
import { mediaKind, type MediaKind } from '../project/media-kinds.ts';
import { stageKind, type StageKind } from '../project/stage-kinds.ts';
import {
  AlignLeft,
  Blend,
  Layers,
  SlidersHorizontal,
  CloudRain,
  Heading,
  Image,
  Clapperboard,
  Film,
  Sparkles,
  SunDim,
  Vibrate,
  CornerDownRight,
  Dices,
  Flag,
  Gamepad2,
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

export type BlockKind = BlockType | AudioKind | StageKind | MediaKind;

export const BLOCK_ICON: Readonly<Record<BlockKind, LucideIcon>> = {
  background: CloudRain,
  look: SunDim,
  effect: Vibrate,
  burst: Sparkles,
  title: Heading,
  transition: Blend,
  post: Layers,
  param: SlidersHorizontal,
  picture: Image,
  video: Clapperboard,
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
  minigame: Gamepad2,
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

/** What the author sees a block as: its type, or its audio, stage or media kind for actions. */
export function blockKind(block: Block): BlockKind {
  return audioKind(block) ?? stageKind(block) ?? mediaKind(block) ?? block.type;
}
