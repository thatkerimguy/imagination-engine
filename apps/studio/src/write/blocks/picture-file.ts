import { MEDIA_INLINE_MAX } from '@ie/story';

/** Width and height that fit inside `max` on the long side, never enlarged. */
export function fitWithin(width: number, height: number, max: number): [number, number] {
  const scale = Math.min(1, max / Math.max(width, height, 1));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

/** Sizes and qualities tried in order until the picture fits inside the novel file. */
export const SHRINK_STEPS: readonly (readonly [number, number])[] = [
  [1600, 0.8],
  [1600, 0.65],
  [1280, 0.65],
  [960, 0.6],
  [720, 0.5],
];

/**
 * Turns a picture file into a small data URL kept inside the novel (ADR 0026): pictures are
 * scaled down and re-encoded, so a phone photo becomes a few hundred kilobytes at most.
 * Resolves null when the file isn't a picture the browser can read.
 */
export async function shrinkPicture(file: Blob): Promise<string | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  try {
    const canvas = document.createElement('canvas');
    const g = canvas.getContext('2d');
    if (!g) return null;
    for (const [max, quality] of SHRINK_STEPS) {
      const [w, h] = fitWithin(bitmap.width, bitmap.height, max);
      canvas.width = w;
      canvas.height = h;
      g.drawImage(bitmap, 0, 0, w, h);
      let data = canvas.toDataURL('image/webp', quality);
      // Browsers that can't write WebP hand back PNG; JPEG is smaller for photos.
      if (!data.startsWith('data:image/webp')) data = canvas.toDataURL('image/jpeg', quality);
      if (data.length <= MEDIA_INLINE_MAX) return data;
    }
    return null;
  } finally {
    bitmap.close();
  }
}
