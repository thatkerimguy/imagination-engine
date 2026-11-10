import { z } from 'zod';
import { labelSchema } from './schema.ts';

/*
 * Optional media (PLAN §6.2, ADR 0026): a picture or a muted video behind the text. Both are
 * `.set` actions, so they are scene state and come back after a load or a rewind. Nothing in the
 * engine depends on them; a host that hasn't installed the media module ignores them.
 */

/** Largest picture kept inside the novel file: the Studio shrinks pictures well below this. */
export const MEDIA_INLINE_MAX = 600_000;

export const MEDIA_FITS = ['cover', 'contain'] as const;
export type MediaFit = (typeof MEDIA_FITS)[number];

const httpsUrl = z
  .string()
  .max(2000)
  .regex(/^https:\/\/\S+$/);

/** A picture is a web address, or a small picture kept inside the novel as a data URL. */
export const mediaSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('url'), url: httpsUrl }),
  z.object({
    kind: z.literal('inline'),
    data: z
      .string()
      .max(MEDIA_INLINE_MAX)
      .regex(/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/),
  }),
]);
export type MediaSource = z.infer<typeof mediaSourceSchema>;

const dim = z.number().min(0).max(0.9);

export const imageSetSchema = z.object({
  /** No source takes the picture away. */
  source: mediaSourceSchema.optional(),
  fit: z.enum(MEDIA_FITS).optional(),
  /** How much the page colour covers the picture so the text stays readable, 0..0.9. */
  dim: dim.optional(),
  /** Words for readers who can't see the picture. */
  alt: labelSchema.optional(),
});
export type ImageSet = z.infer<typeof imageSetSchema>;

export const videoSetSchema = z.object({
  /** No address stops the video. Videos are always muted: sound belongs to the audio blocks. */
  url: httpsUrl.optional(),
  loop: z.boolean().optional(),
  fit: z.enum(MEDIA_FITS).optional(),
  dim: dim.optional(),
});
export type VideoSet = z.infer<typeof videoSetSchema>;

export const MEDIA_ACTIONS = {
  'media.image.set': imageSetSchema,
  'media.video.set': videoSetSchema,
} as const;
export type MediaActionId = keyof typeof MEDIA_ACTIONS;

export function isMediaAction(action: string): action is MediaActionId {
  return action in MEDIA_ACTIONS;
}

export const MEDIA_DIM_DEFAULT = 0.55;

/** What a scene shows behind the text: a video wins over a picture while both are set. */
export type MediaView =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'image';
      readonly src: string;
      readonly fit: MediaFit;
      readonly dim: number;
      readonly alt?: z.infer<typeof labelSchema>;
    }
  | {
      readonly kind: 'video';
      readonly src: string;
      readonly fit: MediaFit;
      readonly dim: number;
      readonly loop: boolean;
    };

export function mediaView(scene: Readonly<Record<string, unknown>>): MediaView {
  const video = videoSetSchema.safeParse(scene['media.video.set']);
  if (video.success && video.data.url)
    return {
      kind: 'video',
      src: video.data.url,
      fit: video.data.fit ?? 'cover',
      dim: video.data.dim ?? MEDIA_DIM_DEFAULT,
      loop: video.data.loop ?? true,
    };
  const image = imageSetSchema.safeParse(scene['media.image.set']);
  if (image.success && image.data.source) {
    const s = image.data.source;
    return {
      kind: 'image',
      src: s.kind === 'url' ? s.url : s.data,
      fit: image.data.fit ?? 'cover',
      dim: image.data.dim ?? MEDIA_DIM_DEFAULT,
      ...(image.data.alt ? { alt: image.data.alt } : {}),
    };
  }
  return { kind: 'none' };
}
