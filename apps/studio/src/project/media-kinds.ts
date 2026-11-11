import type { ActionBlock, Block, MediaActionId } from '@ie/story';

/** Picture and video blocks are action blocks shown in the menu as kinds (ADR 0026). */
export const MEDIA_KINDS = {
  picture: 'media.image.set',
  video: 'media.video.set',
} as const satisfies Record<string, MediaActionId>;
export type MediaKind = keyof typeof MEDIA_KINDS;

export const MEDIA_KIND_LIST = Object.keys(MEDIA_KINDS) as MediaKind[];

export function mediaKind(block: Block): MediaKind | null {
  if (block.type !== 'action') return null;
  return MEDIA_KIND_LIST.find((kind) => MEDIA_KINDS[kind] === block.action) ?? null;
}

/** A new picture or video block. It shows nothing until the author picks the picture or video. */
export function newMediaBlock(id: string, kind: MediaKind): ActionBlock {
  return { id, type: 'action', action: MEDIA_KINDS[kind], params: {} };
}
