// Cover art picker (books, folders, notes), native. The picked image is downscaled on import to
// at most 1200 × 1800 (JPEG 0.84) at `Paths.document/covers/<id>.jpg`, with a 240 × 360 (JPEG
// 0.80) library thumbnail beside it as `<id>.thumb.jpg`. Both are rendered from the ORIGINAL
// picked asset, then moved into place (see cover-pipeline.ts). Returns `null` when cancelled.
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { newSlugId } from '../store/ids.ts';
import { fitInside, type CoverTarget } from './cover-resize.ts';
import { importCover, type CoverDeps, type Source } from './cover-pipeline.ts';
import type { PickedCover } from './cover-types.ts';

async function render(src: Source, target: CoverTarget) {
  const ctx = ImageManipulator.manipulate(src.uri);
  try {
    const size = fitInside(src, target);
    if (size) ctx.resize(size);
    const ref = await ctx.renderAsync();
    try {
      const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: target.quality });
      return { uri: out.uri, width: out.width, height: out.height };
    } finally {
      ref.release();
    }
  } finally {
    ctx.release();
  }
}

function coversDir(): Directory {
  const dir = new Directory(Paths.document, 'covers');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

const deps: CoverDeps = {
  render,
  move(fromUri, name) {
    const dest = new File(coversDir(), name);
    if (dest.exists) dest.delete();
    new File(fromUri).move(dest);
    return { uri: dest.uri, bytes: dest.size ?? 0 };
  },
  copyOriginal(srcUri, id) {
    const ext = /\.(png|jpe?g|webp|heic)$/i.exec(srcUri)?.[1]?.toLowerCase() ?? 'jpg';
    const dest = new File(coversDir(), `${id}.${ext}`);
    new File(srcUri).copy(dest);
    return { uri: dest.uri, bytes: dest.size ?? 0, ext };
  },
  newId: newSlugId,
  warn: (message, err) => console.warn(message, err),
};

export async function pickCoverImage(): Promise<PickedCover | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [2, 3],
    quality: 1,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return importCover({ uri: asset.uri, width: asset.width, height: asset.height }, deps);
}
