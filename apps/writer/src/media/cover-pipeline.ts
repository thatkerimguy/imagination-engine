// Cover import orchestration with injected I/O (so it is testable without native modules).
// Both renders read the ORIGINAL picked image; only finished files are moved into place. Re-reading
// a moved file is what made Android's thumbnail render fail with "Loading bitmap failed".
import type { CoverFile, PickedCover } from './cover-types.ts';
import { COVER_TARGET, THUMB_TARGET, type CoverTarget, type Size } from './cover-resize.ts';

export interface Source extends Size {
  uri: string;
}

export interface CoverDeps {
  /** Renders `src` as a JPEG at `target` into a temporary file. */
  render(src: Source, target: CoverTarget): Promise<Size & { uri: string }>;
  /** Moves a finished file into the covers directory as `name`. */
  move(fromUri: string, name: string): { uri: string; bytes: number };
  /** Copies the original picked file into the covers directory as `<id>.<ext>`. */
  copyOriginal(srcUri: string, id: string): { uri: string; bytes: number; ext: string };
  newId(): string;
  warn(message: string, err: unknown): void;
}

const MIME: Record<string, string> = {
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

export async function importCover(src: Source, d: CoverDeps): Promise<PickedCover> {
  const id = d.newId();
  let cover: Size & { uri: string };
  try {
    cover = await d.render(src, COVER_TARGET);
  } catch (err) {
    d.warn('[writer] cover downscale failed; keeping the original', err);
    const c = d.copyOriginal(src.uri, id);
    const file: CoverFile = {
      uri: c.uri,
      width: src.width,
      height: src.height,
      bytes: c.bytes,
      mimeType: MIME[c.ext] ?? 'image/jpeg',
    };
    return { cover: file, thumb: null };
  }
  let thumb: (Size & { uri: string }) | null = null;
  try {
    thumb = await d.render(src, THUMB_TARGET);
  } catch (err) {
    d.warn('[writer] cover thumbnail failed', err);
  }
  const jpeg = (r: Size & { uri: string }, name: string): CoverFile => {
    const m = d.move(r.uri, name);
    return { uri: m.uri, width: r.width, height: r.height, bytes: m.bytes, mimeType: 'image/jpeg' };
  };
  const coverFile = jpeg(cover, `${id}.jpg`);
  let thumbFile: CoverFile | null = null;
  if (thumb) {
    try {
      thumbFile = jpeg(thumb, `${id}.thumb.jpg`);
    } catch (err) {
      d.warn('[writer] cover thumbnail failed', err);
    }
  }
  return { cover: coverFile, thumb: thumbFile };
}
