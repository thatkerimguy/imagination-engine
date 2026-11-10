import type { ActionBlock, Block, StageActionId } from '@ie/story';

/**
 * Stage blocks are action blocks; the menu shows each kind as a block of its own. A screen effect
 * is one kind with three actions (shake, flash, freeze), switched in its sentence.
 */
export const STAGE_KINDS = {
  background: ['stage.background.set'],
  look: ['stage.look.set'],
  effect: ['stage.shake', 'stage.flash', 'stage.hitstop'],
  burst: ['stage.burst'],
  title: ['stage.title'],
  transition: ['stage.transition'],
} as const satisfies Record<string, readonly StageActionId[]>;
export type StageKind = keyof typeof STAGE_KINDS;

export const STAGE_KIND_LIST = Object.keys(STAGE_KINDS) as StageKind[];

export function stageKind(block: Block): StageKind | null {
  if (block.type !== 'action') return null;
  for (const kind of STAGE_KIND_LIST)
    if ((STAGE_KINDS[kind] as readonly string[]).includes(block.action)) return kind;
  return null;
}

/** A new stage block of `kind` with settings that show something at once. */
export function newStageBlock(id: string, kind: StageKind): ActionBlock {
  switch (kind) {
    case 'background':
      return { id, type: 'action', action: 'stage.background.set', params: { preset: 'rain', amount: 0.6 } };
    case 'look':
      return { id, type: 'action', action: 'stage.look.set', params: { look: 'film' } };
    case 'effect':
      return { id, type: 'action', action: 'stage.shake', params: { strength: 0.5 } };
    case 'burst':
      return { id, type: 'action', action: 'stage.burst', params: { preset: 'burst' } };
    case 'title':
      return {
        id,
        type: 'action',
        action: 'stage.title',
        params: { text: { en: '', tr: '' }, seconds: 3, exit: 'fade' },
      };
    case 'transition':
      return { id, type: 'action', action: 'stage.transition', params: { kind: 'dissolve', seconds: 1.2 } };
  }
}
