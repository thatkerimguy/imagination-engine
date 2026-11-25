// Pure cover sizing: fit-inside targets that preserve aspect ratio and never upscale, plus the
// `.thumb.jpg` sidecar naming. Keeps decoded bitmaps small (Play's P90 bitmap memory caps).
export interface Size {
  width: number;
  height: number;
}

export interface CoverTarget {
  maxWidth: number;
  maxHeight: number;
  /** JPEG quality, 0–1. */
  quality: number;
}

/** Export / display cover: max 1200 × 1800. */
export const COVER_TARGET: CoverTarget = { maxWidth: 1200, maxHeight: 1800, quality: 0.84 };
/** Library thumbnail: max 240 × 360. */
export const THUMB_TARGET: CoverTarget = { maxWidth: 240, maxHeight: 360, quality: 0.8 };

/**
 * The size to resize `src` to so it fits inside the target box, or `null` when it already fits
 * (never upscales). Dimensions are rounded and never below 1 px.
 */
export function fitInside(src: Size, target: Pick<CoverTarget, 'maxWidth' | 'maxHeight'>) {
  if (!(src.width > 0 && src.height > 0)) return null;
  const scale = Math.min(target.maxWidth / src.width, target.maxHeight / src.height);
  if (scale >= 1) return null;
  return {
    width: Math.max(1, Math.round(src.width * scale)),
    height: Math.max(1, Math.round(src.height * scale)),
  } satisfies Size;
}

/** `…/covers/<id>.jpg` → `…/covers/<id>.thumb.jpg`. Data / http URIs have no sidecar. */
export function thumbUriForCover(uri: string): string {
  if (!/^file:/i.test(uri)) return uri;
  if (/\.thumb\.jpg$/i.test(uri)) return uri;
  return uri.replace(/(\.[a-z0-9]+)?$/i, '.thumb.jpg');
}

/** True for a cached thumbnail sidecar file name. */
export const isThumbName = (name: string): boolean => /\.thumb\.jpg$/i.test(name);
