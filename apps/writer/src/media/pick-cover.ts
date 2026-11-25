// Cover art picker (books, folders, notes), native. The picked image is downscaled on import to
// at most 1200 × 1800 (JPEG 0.84) at `Paths.document/covers/<id>.jpg`, with a 240 × 360 (JPEG
// 0.80) library thumbnail cached beside it as `<id>.thumb.jpg`, so large libraries decode small
// bitmaps only. If resizing fails the original is copied as before (no thumbnail; readers fall
// back to the cover). Returns the cover's file URI, or `null` when cancelled.
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { newSlugId } from '../store/ids.ts';
import {
  COVER_TARGET,
  fitInside,
  THUMB_TARGET,
  type CoverTarget,
  type Size,
} from './cover-resize.ts';

interface Saved extends Size {
  uri: string;
}

/** Resizes (never upscales) and re-encodes `src` as JPEG into `dest`. */
async function renderJpeg(src: Saved, target: CoverTarget, dest: File): Promise<Saved> {
  const ctx = ImageManipulator.manipulate(src.uri);
  try {
    const size = fitInside(src, target);
    if (size) ctx.resize(size);
    const ref = await ctx.renderAsync();
    try {
      const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: target.quality });
      if (dest.exists) dest.delete();
      new File(out.uri).move(dest);
      return { uri: dest.uri, width: out.width, height: out.height };
    } finally {
      ref.release();
    }
  } finally {
    ctx.release();
  }
}

export async function pickCoverImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [2, 3],
    quality: 1,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  const dir = new Directory(Paths.document, 'covers');
  if (!dir.exists) dir.create({ intermediates: true });
  const id = newSlugId();
  try {
    const src = { uri: asset.uri, width: asset.width, height: asset.height };
    const cover = await renderJpeg(src, COVER_TARGET, new File(dir, `${id}.jpg`));
    try {
      await renderJpeg(cover, THUMB_TARGET, new File(dir, `${id}.thumb.jpg`));
    } catch (err) {
      console.warn('[writer] cover thumbnail failed', err);
    }
    return cover.uri;
  } catch (err) {
    console.warn('[writer] cover downscale failed; keeping the original', err);
    const ext = /\.(png|jpe?g|webp|heic)$/i.exec(asset.uri)?.[1]?.toLowerCase() ?? 'jpg';
    const dest = new File(dir, `${id}.${ext}`);
    new File(asset.uri).copy(dest);
    return dest.uri;
  }
}
